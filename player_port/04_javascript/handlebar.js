/* MAIN HANDLEBAR CODE */
/* Code that takes care of putting the application together */

const { ipcRenderer } = require("electron");

/** Global variable for storing data */
var json_obj;

var App = (function () {
    // custom templating helpers
    Handlebars.registerHelper("get_number", function (id) {
        var regex = /\d+/;
        var num = id.match(regex);
        if (null == num) num = "i";
        return num + ".";
    });

    Handlebars.registerHelper('if_equals', function(arg1, arg2, options) {
        return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });

    Handlebars.registerHelper("increment", function(num) {
        return ++num;
    });

    // helper to get current language -- for displaying annotations in specific language
    Handlebars.registerHelper("language", function() {
        return Language.language();
    });

    // helper to check for language -- for displaying user interface text 
    Handlebars.registerHelper("currentLanguage", function(lang) {
        return json_obj.languages[lang] == Language.language();
    });

    /**
     * As a parameter gets id of block and puts it into whatever language is needed
     * -- wrapper, the interesting function is located in module Language
     */
    Handlebars.registerHelper("getTranslation", function(toTranslate) {
        
        return Language.translate(toTranslate);
    });

    /**
     * Implements language switch
     */
    Handlebars.registerHelper("languageSwitch", function () {
        str = "";
        for (l of Language.getProvidedLanguage()) {
            str += '<option value="'+ l + '"';
            if (l == Language.language()) {
                str += ' selected';
                console.log("selected " + l);
            }
            str += '>' + l + '</option>';
        }
        return str;
    });

    
    Handlebars.registerHelper("notNullLanguages", function() {
        return Language.getProvidedLanguage().length > 0;
    });

    (function main() {

        var addr = location.search.slice(1, location.search.length);
        local_data = JSON.parse(window.localStorage.getItem(addr));

        // for loading from local data -- used for quick and dirty annotation in browser
        /*if (local_data != null) {
            var loading_style = "<style type='text/css'> #loading_screen {background-image:  linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url('" + addr + "/background.jpg');background-position:center;background-size: cover;} </style>";
            document.querySelector("body").innerHTML += loading_style;
            document.addEventListener("DOMContentLoaded", function(){
                main_templating(null, local_data);
            });
            return;
        }*/
        // getting json file using XMLHttpRequest
        load_from_web_or_user(addr);
    })();

    function load_from_web_or_user(addr) {
        var oReq = new XMLHttpRequest();
        oReq.addEventListener("load", main_templating);
        oReq.onerror = function () { console.log('Fetch Error', err); };
        // loading custom json file
        if (addr == "") {
            // load custom json
            document.querySelector("body").innerHTML += '<form name="form_input" enctype="multipart/form-data">\
            <input type="file" name="uploaded_json" id="file" />\
            <button type="button" onclick="App.load_json()">Nahrajte upravený JSON soubor</button>\
            </form>';
        }
        else {
            var loading_style = "<style type='text/css'> #loading_screen {background-image:  linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url('" + addr + "/background.jpg');background-position:center;background-size: cover;} </style>";
            document.querySelector("body").innerHTML += loading_style;
            oReq.open('get', addr + "/info.json", true);
            oReq.send();
        }
    }

    /**
     * Main function that puts together templates based on the json parameters. 
     * Should be called either with json object or from response asking for the json file. 
     * @param {*} e event
     * @param {object} custom_json object containing information about player 
     * -- if left out will try to parse response text from request.
     */
    function main_templating(e, custom_json, only_player = false) {
        if (custom_json != undefined) {
            json_obj = custom_json;
        } else {
            json_obj = JSON.parse(this.responseText);
        }
        // decide what language should be used
        Language.determineLanguage();
        console.log(Language.language());
        
        // control panel
        put_template_to_html(null, "body", Handlebars.templates.control_panel)
        
        // title
        document.querySelector("title").innerHTML = json_obj.title;
        try {
            document.getElementById("heading").innerHTML = json_obj.title;
        } catch (e) {}

        // orbit controls -- get rid of redundant stuff
        if (json_obj.player.orbit_control == true) {
            document.getElementById("control_panel").classList.add("orbit_control");
            document.addEventListener("joystick-created", function() {
                document.getElementById("joystick").classList.add("invisible");
            });
        }
        // multiple model selection
        if (json_obj.player.model_src == "") {
            put_template_to_html(json_obj.player, "#loading_screen", Handlebars.templates.model_choice);
        }
        // 3d player
        put_template_to_html(json_obj.player, "body", Handlebars.templates.player);
        create_model(json_obj.player.model_src, json_obj.player.model_scale, json_obj.player.model_rotation);
        // annotations
        console.log("orbit controls: " + json_obj.player.orbit_control);
        put_template_to_html(json_obj, "a-scene", Handlebars.templates.popup_button);
        put_template_to_html(json_obj, "body", Handlebars.templates.popup);
        // gallery
        for (const gallery of json_obj.galleries) {
            GalleryControl.build_gallery(gallery);
        }
        
        // check for edit mode
        //if(json_obj.edit_mode) {
            document.addEventListener("template_done", function () {
                console.log("init of annotation windows.")
                AnnotationWindow.init_annotation_editor();
                AnnotationWindow.make_edit_buttons_apear();
            });
        //}

        // templating done
        var done_event = new Event("template_done");
        document.dispatchEvent(done_event);

        // set up camera rotation -- DONE IN control.js under component 'big-model'!!
        /*if (json_obj.player.camera_rotation != null) {
            var camera = document.getElementById("camera");
            // little cheeky wait for camera to exist..
            (function waitForElement(){
                if(typeof camera.components == "undefined") {
                    setTimeout(waitForElement, 250);
                } else {
                    //console.log("Camera should be here");
                    ControlPanel.go_to_position(null, json_obj.player.camera_position + " " + json_obj.player.camera_rotation);
                }
            })();
        }*/
    }

    /**
     * Function used to load json uploaded by user using form
     */
    function load_json() {
        var file = document.getElementById('file');
        
        if(file.files.length) {
            var reader = new FileReader();
            
            reader.onload = function(e) {
                //document.getElementById('outputDiv').innerHTML = e.target.result;
                main_templating(null, JSON.parse(e.target.result));
            };
            
            reader.readAsText(file.files[0]);
        }
    }
    /**
     * Helper function to put data into Handlebars template
     * @param {Object} data_obj 
     * @param {string} parent_selector 
     * @param {function} compiled_template in form Handlebars.templates.template_filename_without_extension
     */
    function put_template_to_html(data_obj, parent_selector, compiled_template) {
        try {
            var html = compiled_template(data_obj);
            var parent = document.querySelector(parent_selector);
            var new_els = create_element_fromHTML(html);
            for (var el of new_els) {
                parent.appendChild(el);
            }
        } catch (TypeError) {
            console.log("Element "+ parent_selector +" doesnt exist.");
        } // to take care for missing galleries
    }

    /**
     * Creates html node from html
     * @param {string} htmlString 
     */
    function create_element_fromHTML(htmlString) {
        var div = document.createElement('div');
        div.innerHTML = htmlString;
    
        // Changed to div.childNodes to support multiple top-level nodes
        return div.childNodes; 
    }

    function create_model(model_src, model_scale, model_rotation) {
        var model = document.createElement("a-entity");
        model.setAttribute("my-gltf-model", model_src);
        model.setAttribute("id", "gltf_model");
        //model.classList.add("clickable");
        model.setAttribute("big_model", "");
        //model.setAttribute("transform-controls", ""); // for rotation in 3D annotator
        model.setAttribute("autoscale", 'scale:'+ model_scale + '; rotation: '+ model_rotation);
        document.querySelector("a-scene").appendChild(model);
    }

    function save_json() {
        ipcRenderer.sendSync("save_json", json_obj);
    }

    return {
        load_json: load_json,
        put_template_to_html: put_template_to_html,
        create_model: create_model,
        save_json: save_json
    };

})();