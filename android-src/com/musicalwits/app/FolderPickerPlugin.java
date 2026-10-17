package com.musicalwits.app;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.DocumentsContract.Document;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

// Lets the game pick a whole music folder on Android. The app's normal file picker
// can only choose single files, so this opens Android's own folder picker instead,
// lists every file in the folder and its album folders, and copies songs one at a
// time to where the game can read them.
@CapacitorPlugin(name = "FolderPicker")
public class FolderPickerPlugin extends Plugin {

    @PluginMethod
    public void pick(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        startActivityForResult(call, intent, "folderPicked");
    }

    @ActivityCallback
    private void folderPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null || data.getData() == null) {
            JSObject none = new JSObject();
            none.put("files", new JSArray());
            call.resolve(none);
            return;
        }
        Uri tree = data.getData();
        new Thread(() -> {
            try {
                JSArray files = new JSArray();
                walk(tree, DocumentsContract.getTreeDocumentId(tree), "Folder", files, 0);
                JSObject res = new JSObject();
                res.put("files", files);
                call.resolve(res);
            } catch (Exception e) {
                call.reject("Could not read that folder: " + e.getMessage());
            }
        }).start();
    }

    private void walk(Uri tree, String docId, String path, JSArray out, int depth) {
        if (depth > 8) return;
        Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, docId);
        String[] cols = {
            Document.COLUMN_DOCUMENT_ID, Document.COLUMN_DISPLAY_NAME, Document.COLUMN_MIME_TYPE, Document.COLUMN_SIZE
        };
        try (Cursor c = getContext().getContentResolver().query(children, cols, null, null, null)) {
            if (c == null) return;
            while (c.moveToNext()) {
                String id = c.getString(0);
                String name = c.getString(1);
                String mime = c.getString(2);
                long size = c.isNull(3) ? 0 : c.getLong(3);
                String rel = path + "/" + name;
                if (Document.MIME_TYPE_DIR.equals(mime)) {
                    walk(tree, id, rel, out, depth + 1);
                } else {
                    JSObject f = new JSObject();
                    f.put("uri", DocumentsContract.buildDocumentUriUsingTree(tree, id).toString());
                    f.put("name", name);
                    f.put("type", mime == null ? "" : mime);
                    f.put("size", size);
                    f.put("path", rel);
                    out.put(f);
                }
            }
        }
    }

    @PluginMethod
    public void copy(PluginCall call) {
        String uri = call.getString("uri");
        if (uri == null) {
            call.reject("No song given");
            return;
        }
        new Thread(() -> {
            File dir = new File(getContext().getCacheDir(), "picked");
            dir.mkdirs();
            // The game has already read the previous song, so clear it to save space.
            File[] old = dir.listFiles();
            if (old != null) for (File f : old) f.delete();
            File dest = new File(dir, "song-" + System.nanoTime());
            try (InputStream in = getContext().getContentResolver().openInputStream(Uri.parse(uri));
                 OutputStream os = new FileOutputStream(dest)) {
                if (in == null) throw new Exception("empty file");
                byte[] buf = new byte[65536];
                int n;
                while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
                JSObject res = new JSObject();
                res.put("path", dest.getAbsolutePath());
                call.resolve(res);
            } catch (Exception e) {
                dest.delete();
                call.reject("Could not read that song: " + e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void cleanup(PluginCall call) {
        File[] files = new File(getContext().getCacheDir(), "picked").listFiles();
        if (files != null) for (File f : files) f.delete();
        call.resolve();
    }
}
