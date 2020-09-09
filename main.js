// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const { remote } = require('electron');
const fs = require("fs"); 
const ProgressBar = require('electron-progressbar');
//const path = require("path");

// Create the browser window.
var mainWindow;
var serverWindow;
var galleryWindow;
var MainInfo;
var currentPath;
var lastFold;

function initApp() {
    // server
    serverWindow = new BrowserWindow({
        show: false,
        webPreferences: {
            nodeIntegration: true
        }
    });
    serverWindow.loadFile("html/server.html");

    mainWindow = new BrowserWindow({
        //width: 800,
        //height: 600,
        show: false,
        webPreferences: {
            nodeIntegration: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.removeMenu();
    mainWindow.maximize();
    mainWindow.once("ready-to-show", () => {
        mainWindow.show();
    });
    mainWindow.loadFile('welcome_screen.html');

    // Open the DevTools.
    mainWindow.webContents.openDevTools();

    mainWindow.on('close', function(e) {
        const choice = require('electron').dialog.showMessageBoxSync(this,
          {
            type: 'question',
            buttons: ['Yes', 'No'],
            title: 'Confirm',
            message: 'Are you sure you want to quit?'
          });
        if (choice === 1) {
          e.preventDefault();
        } else {
            // erase temporary files
            rmDir = function(dirPath) {
                try { var files = fs.readdirSync(dirPath); }
                catch(e) { return; }
                if (files.length > 0)
                  for (var i = 0; i < files.length; i++) {
                    var filePath = dirPath + '/' + files[i];
                    if (fs.statSync(filePath).isFile()) {
                        if (files[i] != "player_debug.html")
                            fs.unlinkSync(filePath);
                    } else
                      rmDir(filePath);
                  }
                try { var files = fs.readdirSync(dirPath); }
                catch(e) { return; }
                if (files.length == 0)
                    fs.rmdirSync(dirPath);
            };

            rmDir("player_port/player");
            serverWindow.close();
        }
      });

}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', initApp);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') app.quit()
})



app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// switch between new and old projects
ipcMain.on("open", openProject);
ipcMain.on("create_project", createProject);
ipcMain.on("getRPOP", function () {
    mainWindow.webContents.send("realPathOfProject", currentPath);
});
ipcMain.on("goHome", () => {
    mainWindow.loadFile("welcome_screen.html");
});
ipcMain.on("openHelp", () => {
    hlp = new BrowserWindow({
    });
    hlp.loadFile("html/help.html");
})

ipcMain.on("save_json", function (e, json_obj) {
    console.log("Gonna save JSON");
    var data = JSON.stringify(json_obj);

    // write into the actual project path
    fs.writeFile(path.join(currentPath, "info.json"), data, (err) => {
        if (err) throw err;
        console.log('Data written to project path');
    });

    // write into the temp version
    fs.writeFileSync(path.join("player_port/player/" + lastFold, "info.json"), data, (err) => {
        if (err) throw err;
        console.log('Data written to temp path');
    });

    e.returnValue = "received";

});

ipcMain.on("readRelative", function (e, pat) {
    mainWindow.webContents.send("requestedFile", JSON.parse(fs.readFileSync(currentPath + "/" + pat)));
});

ipcMain.on("initGalleryWindow", function (e, info) {
    createGalleryWindow();
    galleryWindow.once("ready-to-show" , () => {
        console.log("created gallery window, will send data to it");
        info.gallery_path = "player_port/player/" + lastFold + "/galleries/" + info.gallery_path;
        galleryWindow.webContents.send("gallery_data", info);
    });
    
});

function openProject(e, pat) {
    if (!correctPath(pat)) {
        // open refusal dialog
        dialog.showMessageBox(null, {
            message: "The path does not appear to lead to a correct project folder.",});
        return;
    }

    currentPath = pat;

    // copy the path into the project folder
    var ncp = require('ncp').ncp;
 
    ncp.limit = 16;
    lastFold = pat.split(pat.sep).pop();
    //console.log(lastFold);
    ncp(pat, "player_port/player/" + lastFold, function (err) {
        if (err) {
            return console.error(err);
        }
        console.log('done!');
        mainWindow.loadURL("http://localhost:8080/player/player_debug.html?" + lastFold);
    });
    // correct path - can load the info
    //MainInfo = JSON.parse(fs.readFileSync(path + '/info.json'));
    //`file://${__dirname}/player_port/player/player_debug.html`
    // will have to change the main player loading code here - it will get the path from this thread via ipc
    
}

function correctPath(path) {
    // check if the path can actually be a 3D project
    return fs.existsSync(path + "/info.json");
}

function createProject(e, data) {
    if (!correctData(data)) return; // dialogs should be taken care of in correctData function
    
    // create and fire up progressbar
    var progressBar = new ProgressBar({
        text: 'Setting up project...',
        detail: 'Optimizing models, copying files, may take a few minutes'
    });

    progressBar
        .on('completed', function() {
            console.info(`completed...`);
            progressBar.detail = 'Done...';
        })
        .on('aborted', function() {
            console.info(`aborted...`);
        });

    
    //console.log("Written json to " + path.join(data.path, "info.json"));
    // copy models and perform some operations on them
    
    for (var model of data.models) {
        var ext = model.model_sr.slice(-4);
        var newModelPath = path.join(data.path, path.basename(model.model_sr).split(".")[0] + ".glb");
        if (ext == ".glb") {
            fs.copyFileSync(model.model_sr, newModelPath);
        } else if (ext == "gltf") {
            // TODO --- texture optimization, draco compression and convert to .glb
        } else {
            // must be .obj
            simplifyModel(model.model_sr, newModelPath);
        }
    }

    // create info.json
    data.models = data.models.map((model) => {
        var folder = data.path.split(path.sep).pop();
        var file = model.model_sr.split(path.sep).pop();
        model.model_sr = folder + "/" + file;
        return model;
    });
    var info = {
        "title": "", // TODO -- title is obsolete?
        "languages": data.titles,
        "player": {
            "orbit_control": data.orbitControl,
            "model_src": data.models.length == 1 ? data.models[0].model_sr : "",
            "qualities": data.models,
            "camera_position": "0 0 0",
            "model_scale": "30",
            "model_rotation": "-90, 0, 0",
            "backgound_color": "black"
        },
        "annotations": {},
        "galleries": []
    }

    // save JSON file
    fs.writeFileSync(path.join(data.path, "info.json"), JSON.stringify(info));

    console.log("Done");
    progressBar.setCompleted();
    openProject(null, data.path);
}

// TODO!!!!!
function simplifyModel(modelPath, newPath) {
    const obj2gltf = require('obj2gltf');
    const gltfPipeline = require('gltf-pipeline');
    const fsExtra = require('fs-extra');

    obj2gltf(modelPath)
    .then(function(gltf) {
        // converted into gltf
        //const data = Buffer.from(JSON.stringify(gltf));
        //fs.writeFileSync(newPath + '/tmp.gltf', data);

        const options = {
            separateTextures: true,
            dracoOptions: {
                compressionLevel: 10
            }
        };

        gltfPipeline.processGltf(gltf, options)
        .then(function(results) {
            fsExtra.writeJsonSync(newPath + '/tmp/' + 'model-separate.gltf', results.gltf);
            // Save separate resources
            const separateResources = results.separateResources;
            for (const relativePath in separateResources) {
                if (separateResources.hasOwnProperty(relativePath)) {
                    const resource = separateResources[relativePath];
                    fsExtra.writeFileSync(newPath + '/tmp/' + relativePath, resource);
                }
            }

            // for each resource -- do img compression
            let dirCont = fs.readdirSync(newPath + '/tmp');
            dirCont.filter(function(elm) {return elm.match(/.*\.(jpg?jpeg?JPEG?JPG)/ig);}).map(function (el) {
                Jimp.read(newPath + '/tmp/' + el)
                .then(img => {
                    return img
                    .quality(85) // set JPEG quality
                    .write(newPath + '/tmp/' + el); // save
                })
                .catch(err => {
                    console.error(err);
                });
            });


            // save as draco glb -- TODO
            gltfPipeline.gltfToGlb(gltf)
            .then(function(results) {
                fsExtra.writeFileSync('model.glb', results.glb);
            });

        });

    });
    // TODO -- should work the same as obj2optimizedGlb
}

function correctData(data) {
    //console.log(data);
    var ret = true;
    var msg = "";
    if (data.path === "") {
        msg += "Path to project must be provided.\n";
        ret = false;
    }
    if (data.languages.length == 0) {
        msg += "No language specified.\n";
        ret = false;
    }
    if (Object.values(data.titles).length == 0 || !Object.values(data.titles).every(title => title != "")) {
        msg += "All languages should have titles.\n";
        ret = false;
    }
    if (!data.models.every(model => model.model_sr != "")) {
        msg += "All models should have some path.";
        ret = false;
    }
    //const { dialog } = require('electron')
    if (!ret) dialog.showMessageBox({
                type: 'info',
                buttons: [],
                title: 'Missing information',
                message: msg,
            });
    return ret;
}


function createGalleryWindow() {
    // start gallery choice window
    galleryWindow = new BrowserWindow({
        show: false,
        parent: mainWindow,
        modal: true, 
        webPreferences: {
            nodeIntegration: true,
        }
    });

    // TODO -- doesnt work for some reason!!!
    galleryWindow.on('close', function(e) {
        const choice = require('electron').dialog.showMessageBoxSync(this,
          {
            type: 'question',
            buttons: ['Yes', 'No'],
            title: 'Confirm',
            message: 'Do you want to save this gallery?'
          });
        if (choice === 0) {
            // save gallery and end
            galleryWindow.webContents.executeJavascript("saveGallery()");
            //ipcMain.once("gallerySaved", (e, info) => {
            //mainWindow.webContents.send("gallerySaved", info);
            //galleryWindow.close();
            //});
            
            e.preventDefault();
        } else {
            // just closes -- destroy all that has been done in gallery
            // TODO
        }
    });

    galleryWindow.once('ready-to-show', () => {
        galleryWindow.show();
    });

    galleryWindow.webContents.openDevTools();

    galleryWindow.loadFile("html/galleryConfig.html");
}

ipcMain.on("saveGallery", (e, data) => {
    // copy new files to the actual folder if dirty flag
    // TODO - dirty flag
    // TODO -- loading popup
    // get actual filenames instead of paths
    //console.log(data.newly_added);
    

    newly_added = data.newly_added.map((pat) => {
        //console.log(pat);
        return pat.split(path.sep).pop();
    });

    var galleryName = data.gallery_path.split("/").pop();

    // ensure that the path to copy to exists
    makePathToFile(currentPath + "/galleries/" + galleryName + "/full/mock");

    for (file of newly_added) {
        // copy 
        //console.log("copying from: " + data.gallery_path + "/full/" + file + "   to: " + currentPath + "/galleries/" + galleryName + "/full/" + file);
        fs.copyFile(data.gallery_path + "/full/" + file, currentPath + "/galleries/" + galleryName + "/full/" + file, (err) => {if (err) throw err }); // TODO -- solve this path hell :D 
        
        //console.log("copying from: " + data.gallery_path + "/" + file.split(".")[0] + ".jpg" + "  to: " + currentPath + "/galleries/" + galleryName + "/" + file.split(".")[0] + ".jpg");
        fs.copyFile(data.gallery_path + "/" + file.split(".")[0] + ".jpg", currentPath + "/galleries/" + galleryName + "/" + file.split(".")[0] + ".jpg", (err) => {if (err) throw err });
    }

    // save JSON
    var json = JSON.stringify(data.json);

    // write into the actual project path
    fs.writeFile(currentPath + "/galleries/" + galleryName + "/dir_list.json", json, (err) => {
        if (err) throw err;
        console.log('Written gallery to actual folder.');
    });

    fs.writeFile(data.gallery_path + "/dir_list.json", json, (err) => {
        if (err) throw err;
        console.log('Written gallery to local.');
    });
    
    // let mainWindow know
    mainWindow.webContents.send("galleryCreated", {
        "json_gallery_src": lastFold + "/galleries/" + galleryName,
        "parent_id": "", // filled by annotation_window in renderer
        "has_full_size_version": true
    });
    galleryWindow.close();
});


function makePathToFile(filePath) {
    const path = require("path");
    var dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
      return true;
    }
    makePathToFile(dirname);
    fs.mkdirSync(dirname);
}
