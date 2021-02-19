// Modules to control application life and create native browser window
const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path');
const fs = require("fs"); 
const fsExtra = require('fs-extra');
const ProgressBar = require('electron-progressbar');
const Jimp = require("jimp");
var progressBar;

// window variables
var mainWindow;
var serverWindow; // used just for serving files for the player imitation
var galleryWindow;

// path to currently processed project
var currentPath;
var lastFold; // last folder of the path

/**
 * Main app driving functions
 */
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
    //mainWindow.webContents.openDevTools();

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
            eraseTemporaries();
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


/**
 * BACKEND -- FRONTEND COMMUNICATION
 */

ipcMain.on("open", openProject);
ipcMain.on("create_project", createProject);

// not used I think
ipcMain.on("getRPOP", function () {
    mainWindow.webContents.send("realPathOfProject", currentPath);
});

ipcMain.on("goHome", () => {
    eraseTemporaries();
    mainWindow.loadFile("welcome_screen.html");
});

ipcMain.on("focusMain", () => { mainWindow.blur(); mainWindow.focus(); });

ipcMain.on("openHelp", () => {
    hlp = new BrowserWindow({
    });
    hlp.loadFile("html/help.html");
})

ipcMain.on("save_json", function (e, json_obj) {
    console.log("Gonna save JSON");
    var data = JSON.stringify(json_obj);

    // write into the temp version
    fs.writeFileSync(path.join(__dirname + "/player_port/player/" + lastFold, "info.json"), data, (err) => {
        if (err) throw err;
        console.log('Data written to temp path');
    });

    // write into the actual project path
    fs.writeFile(path.join(currentPath, "info.json"), data, (err) => {
        if (err) throw err;
        console.log('Data written to project path');
    });

    e.returnValue = "received";

});

ipcMain.on("readRelative", function (e, pat) {
    mainWindow.webContents.send("requestedFile", JSON.parse(fs.readFileSync(currentPath + "/" + pat)));
});

// Communication with gallery window

ipcMain.on("initGalleryWindow", function (e, info) {
    createGalleryWindow();
    galleryWindow.once("ready-to-show" , () => {
        console.log("created gallery window, will send data to it");
        //console.log(info.gallery_path)
        //console.log(info.gallery_path.toString())
        info.gallery_path =  path.join(__dirname, "player_port/player", lastFold, "galleries", info.gallery_path.toString());
        galleryWindow.webContents.send("gallery_data", info);
    });
    
});


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

    var galleryName = data.gallery_path.split(path.sep).pop();

    console.log("Paths");
    console.log(data.gallery_path);
    //data.gallery_path = path.join(__dirname, data.gallery_path);   
    // ensure that the path to copy to exists
    makePathToFile(path.join(currentPath, "galleries", galleryName, "full/mock"));

    for (file of newly_added) {
        // copy 
        //console.log("copying from: " + data.gallery_path + "/full/" + file + "   to: " + currentPath + "/galleries/" + galleryName + "/full/" + file);
        fs.copyFile(path.join(data.gallery_path, "full", file), path.join(currentPath, "galleries", galleryName, "full", file), (err) => {if (err) throw err }); // TODO -- solve this path hell :D 
        
        //console.log("copying from: " + data.gallery_path + "/" + file.split(".")[0] + ".jpg" + "  to: " + currentPath + "/galleries/" + galleryName + "/" + file.split(".")[0] + ".jpg");
        fs.copyFile(path.join(data.gallery_path, file.split(".")[0] + ".jpg"), path.join(currentPath, "/galleries/", galleryName, file.split(".")[0] + ".jpg"), (err) => {if (err) throw err });
    }

    // save JSON
    var json = JSON.stringify(data.json);

    // write into the actual project path
    fs.writeFileSync(currentPath + "/galleries/" + galleryName + "/dir_list.json", json, (err) => {
        if (err) throw err;
        console.log('Written gallery to actual folder.');
    });

    fs.writeFileSync(data.gallery_path + "/dir_list.json", json, (err) => {
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

/**
 * Creates gallery window that is used for gallery creation and annotation
 */
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

    //galleryWindow.webContents.openDevTools();

    galleryWindow.loadFile("html/galleryConfig.html");
}

/**
 * Opens project given a path
 * @param {*} e just some event var
 * @param {*} pat path of project, string
 */
function openProject(e, pat) {
    console.log(pat);
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
    lastFold = pat.split(path.sep).pop();
    //console.log(lastFold);
    ncp(pat, __dirname + "/player_port/player/" + lastFold, function (err) {
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

/**
 * FUNCTIONS FOR PROJECT CREATION
 */

/**
 * Creates project, provided with the data from the form.
 * @param {*} e 
 * @param {*} data 
 */
function createProject(e, data) {
    (async () => {
        if (!correctData(data)) return; // dialogs should be taken care of in correctData function
        
        // create and fire up progressbar
        startProgressbar();

        fs.copyFile(data.imagePath, path.join(data.path, "background.jpg"), (err) => {if (err) console.log(err)})
        //console.log("Written json to " + path.join(data.path, "info.json"));
        // copy models and perform some operations on them
        
        try {
            for (var model of data.models) {
                var ext = model.model_sr.slice(-4);
                console.log(ext);
                var newModelPath = path.join(data.path, path.basename(model.model_sr).split(".")[0] + ".glb");
                if (ext == ".glb") {
                    fs.copyFileSync(model.model_sr, newModelPath);
                } else if (ext == "gltf") {
                    var gltf = await fsExtra.readJSON(model.model_sr);
                    await simplifyModel(newModelPath, gltf/*fsExtra.readJsonSync(model.model_sr)*/);
                } else {
                    // must be .obj
                    console.log("Simplifying model");
                    await obj2simplifiedGlb(model.model_sr, newModelPath);
                }
            }
        } catch (e) {
            dialog.showMessageBoxSync({
                type: "error",
                message: "There has been some error in model processing:\n" + e
            });
            return;
        }
    
        // create info.json
        data.models = data.models.map((model) => {
            var folder = data.path.split(path.sep).pop();
            var file = model.model_sr.split(path.sep).pop().split(".")[0] + ".glb";
            const {size} = fs.statSync(path.join(data.path, file));
            model.file_size = Math.round(size / 1000000.0) + "";
            model.model_sr = folder + "/" + file;
            // get model size
            
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
        
        
    })()
    .then( () => {
        progressBar.setCompleted();
        openProject(null, data.path);
    })
    .catch(err => {
        console.log(err); 
        progressBar.setCompleted();
        // TODO -- alert user and delete files
    })
}

/**
 * Checks if data for creation of a new project are correct
 * @param {*} data 
 */
function correctData(data) {
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

/**
 * Checks for existence of info.json
 * @param {*} path 
 */
function correctPath(path) {
    // check if the path can actually be a 3D project
    return fs.existsSync(path + "/info.json");
}

/**
 * Starts progressbar
 */
function startProgressbar() {
    progressBar = new ProgressBar({
        text: 'Setting up project...',
        detail: 'Optimizing models, copying files, may take a few minutes',
        browserWindow: {
            parent: mainWindow,
            webPreferences: {
                nodeIntegration: true
            }
        }
    });

    progressBar
        .on('completed', function() {
            console.info(`completed...`);
            progressBar.detail = 'Done...';
        })
        .on('aborted', function() {
            console.info(`aborted...`);
        }); 
}

/**
 * MODEL PROCESSING FUNCTIONS
 */

/**
 * Async function that converts .obj model into a draco compressed .glb model.
 * @param {string} modelPath path of the input model
 * @param {string} newPath path of the output model, including its name (correctly should be .glb)
 */
async function obj2simplifiedGlb(modelPath, newPath) {

    const obj2gltf = require('obj2gltf');
    
    console.log("model path " + modelPath);
    console.log("to path " + newPath);
    var pathWithoutLast = path.dirname(newPath);
    if (!fs.existsSync(pathWithoutLast + '/tmp/')) fs.mkdirSync(pathWithoutLast + '/tmp/');

    
    var gltf;
    try {
        gltf = await obj2gltf(modelPath, {separate: true, outputDirectory: pathWithoutLast + '/tmp/', resourceDirectory: pathWithoutLast + '/tmp/'});
    } catch (e) {
        dialog.showMessageBoxSync({
            type: "error",
            message: "There has been an error in conversion of .obj to .gltf:\n" + e
        });
        return -1;
    }
   
    
    try {
        await simplifyModel(newPath, gltf);
    } catch (e) {
        dialog.showMessageBoxSync({
            type: "error",
            message: "There has been an error in optimization of .gltf model:\n" + e
        });
        return -2;
    }

}

/**
 * Async function that optimizes .gltf model -- mainly its textures and converts it to .glb
 * @param {*} pathWithoutLast 
 * @param {*} gltf 
 */
async function simplifyModel (newPath, gltf) {
    
    var pathWithoutLast = path.dirname(newPath);
    if (!fs.existsSync(pathWithoutLast + '/tmp/')) fs.mkdirSync(pathWithoutLast + '/tmp/');
    const gltfPipeline = require('gltf-pipeline');
    
    const options = {
        separateTextures: true,
        dracoOptions: {
            compressionLevel: 10
        },
        resourceDirectory: pathWithoutLast + '/tmp/'
    };

    var results = await gltfPipeline.processGltf(gltf, options);
            
    // TODO -- probably isnt needed       
    //fsExtra.writeJsonSync(pathWithoutLast + '/tmp/' + 'model-separate.gltf', results.gltf);
    // Save separate resources
    const separateResources = results.separateResources;
    for (const relativePath in separateResources) {
        if (separateResources.hasOwnProperty(relativePath)) {
            const resource = separateResources[relativePath];
            fsExtra.writeFileSync(pathWithoutLast + '/tmp/' + relativePath, resource);
        }
    }

    // if we have some textures, compress them
    if (results.gltf.images != undefined) {
        // for each resource -- do img compression
        let dirCont = fs.readdirSync(pathWithoutLast + '/tmp');
        
        var promises = dirCont/*.filter(function(elm) {return elm.match(/.*\.(jpg?jpeg?JPEG?JPG)/ig);})*/.map(function (el) {
            return Jimp.read(pathWithoutLast + '/tmp/' + el)
            .then(img => {
                return img
                .quality(95) // set JPEG quality
                .write(pathWithoutLast + '/tmp/' + el.split(".")[0] + ".jpg"); // save aways as .jpg
            })
            .catch(err => {
                console.error(err);
            });
        }); 

        // when Jimp is done
        await Promise.all(promises);

        // check for .png -- were changed to .jpg
        results.gltf.images = results.gltf.images.map(im => {
            if (im.uri.slice(-3) == "png") {
                im.uri = im.uri.split(".")[0] + ".jpg";
            }
            return im;
        })
}
        
    // save as draco glb
    var glbRes = await gltfPipeline.gltfToGlb(results.gltf, { resourceDirectory: pathWithoutLast + "/tmp"});
    
    fsExtra.writeFileSync(newPath, glbRes.glb);
    rmDir(pathWithoutLast + "/tmp");
    console.log("Model should be ready.");
}


/**
 * HELPER FILESYSTEM FUNCTIONS
 */

function makePathToFile(filePath) {
    const path = require("path");
    console.log("Path " + filePath);
    var dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
      return true;
    }
    makePathToFile(dirname);
    fs.mkdirSync(dirname);
}

function eraseTemporaries() {
    rmDir("player_port/player");
}

function rmDir(dirPath) {
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
