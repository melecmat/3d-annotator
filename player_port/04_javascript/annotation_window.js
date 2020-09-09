

/**
 * Module used for creation of new annottions and manipulation with them.
 */
var AnnotationWindow = (function () {
    var is_dirty = false; // value used for handling unsaved data
    var dirty = { // TODO -- change dirty handling into this object of dirtiness :D
        rot : false
    };  
    const {ipcRenderer} = require('electron');
    const { BrowserWindow, ipcMain } = require('electron').remote;
    const fs = require("fs");
    const path = require("path");
    // path specified by the user
    var realPathOfProject = "";
    //ipcRenderer.send("getRPOP", "");
    //ipcRenderer.once("realPathOfProject", function(e, path) {realPathOfProject = path});

    /**
     * Puts all event listeners.
     */
    function put_listeners() {
        document.getElementById("save_change").addEventListener("click", save_changes);
        document.getElementById("discard_change").addEventListener("click", discard_changes);
        //document.getElementById("reveal_server_v").addEventListener("click", get_version_from_web);
        //document.getElementById("save_browser").addEventListener("click", save_to_local_storage);
        document.getElementById("back_to_main").addEventListener("click", (e) => {
            if (!confirm("Do you want to leave project?")) return;
            ipcRenderer.send("goHome", null);
        });
        document.getElementById("save_button").addEventListener("click", save_json);
        document.getElementById("new_popup_button").addEventListener("click", create_new_popup);

        document.getElementById("change_camera_begin_pos").addEventListener("click", change_camera_begin_pos);

        document.getElementById("new_empty_annot").addEventListener("click", make_annot_in_front);
        document.getElementById("rotate_model").addEventListener("click", toggle_model_rotation);
        document.addEventListener("keydown", (evt) => {
            if (evt.ctrlKey && evt.key === 'n') {
                make_annot_in_front();
            }
            if (evt.ctrlKey && evt.key === 'r') {
                toggle_model_rotation();
            }
        
        });
    }

    function toggle_model_rotation () {
        var model = document.getElementById("gltf_model");
        
        if (model.getAttribute("transform-controls") == null) {
            dirty.rot = true
            model.setAttribute("transform-controls", "");
        } else {
            save_json();
            dirty.rot = false;
            model.removeAttribute("transform-controls"); 
        }
    }

    /**
     * Functions called when editation mode is allowed and user presses ctrl + shift + e.
     * Enables buttons for editing
     */
    function make_edit_buttons_apear () {
        var edit_buttons = document.getElementsByClassName("ed_button");
        for (let button of edit_buttons) {
            make_edit_button_apear(button);
        }
    }

    /**
     * Provided with edit button node, makes this button visible
     * and also sets up its listeners.
     * Used when pressed ctrl + shift ? e but also when new annotation is created
     * by user.
     * @param {Node} button 
     */
    function make_edit_button_apear (button) {
        button.classList.add("visible");
            if(button.parentNode == document.getElementById("control_panel")) return;
            if (button.classList.contains("delete")) {
                button.addEventListener("click", function () {
                    // TODO -- change the way this is implemented -- get parent of the button!!!
                    delete_annotation(button); // slice gets the ID of annotation
                });
            } else 
                button.addEventListener("click", function () {
                    build_annotation_window(button); // slice gets the ID of annotation
                });
    }

    /**
     * Function to prevent data deletion
     */
    function prevent_data_deletion () {
        window.onbeforeunload = function () {
            if (!is_dirty) { // no chang assumed
                return undefined;
            }
            var confirmation_message = "";
            return confirmation_message;
        };
    }

    /**
     * Upon trumbowyg editor creation. Contains functions neded for trumbowyg.
     * Sets up the editor and adds event listeners to editor buttons.
     */
    var Editor = (function() {
        function init_editor (lang) {
            $('#editor' + lang).trumbowyg({
                btns: [
                    ['viewHTML'],
                    ['undo', 'redo'], // Only supported in Blink browsers
                    ['formatting'],
                    ['strong', 'em', 'del'],
                    ['fontfamily'],
                    ['fontsize'],
                    ['foreColor', 'backColor'],
                    ['superscript', 'subscript'],
                    ['link'],
                    ['insertImage'],
                    ['justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'],
                    ['unorderedList', 'orderedList'],
                    ['horizontalRule'],
                    ['removeformat'],
                    ['fullscreen'],
                ],
                plugins: {
                    allowTagsFromPaste: {
                        allowedTags: ['h1', 'h2', 'h3', 'h4', 'p', 'span', 'br', 'strong', 'em', 'del']
                    }
                }
            });

            // buttons EVENT LISTENERS
            /*document.addEventListener("template_done", function () {
                document.getElementById("copy_html").addEventListener("click", copy_html);
                document.getElementById("paste_html").addEventListener("click", paste_html);
            });*/
        }

        /**
         * Initialisation of all the languages.
         */
        function init_editors() {
            for (lang in json_obj.languages) {
                if (json_obj.languages[lang] == "") continue;

                init_editor(lang);
            }
        }

        function empty_editors() {
            for (lang in json_obj.languages) {
                if (json_obj.languages[lang] == "") continue;

                $('#editor' + lang).trumbowyg('empty');
            }
        }

        /** NOT USED ATM
         * Reads text from clipboard and puts it into trumbowyg
         */
        function paste_html() {
            navigator.clipboard.readText()
            .then(text => {
                append_html(text);
            })
            .catch(err => {
                console.error('Failed to read clipboard contents: ', err);
            });
        }

        /** NOT USED ATM
         * Gets HTML contained in trumbowyg editor and puts it into clipboar.
         */
        function copy_html() {
            var htm = $('#editor').trumbowyg('html');
            htm = htm.replace(/\r?\n|\r/g, " ");
            // for copying text into clipboard
            const el = document.createElement('textarea');
            el.value = htm;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
        }

        /**
         * Puts given html into trumbowyg editor.
         * @param {string} html_to_append 
         */
        function append_html(lang, html_to_append) {
            var html = $('#editor' + lang).trumbowyg('html');
            html += html_to_append;
            $('#editor' + lang).trumbowyg('html', html);
        }

        return {
            init_editors: init_editors,
            append_html: append_html,
            empty_editors : empty_editors
        };

    })();

    /**
     * Puts data into annotation window and makes it visible.
     * @param {object} annotation_object 
     * @param {Node} button
     */
    function build_annotation_window(button, annotation_id = null/*annotation_id, annotation_info*/) {
        // put data into annotation window
        //var annotation_info = json_obj.annotations[annotation_id];
        is_dirty = true; // something is hapenning -- better note the changes
        var annotation_info = {};
        if (button != null) { // if creating new annotation
            // get information from buttons parent
            annotation_id = button.parentNode.id;
            annotation_info = json_obj.annotations[annotation_id];
        }
        
        try {
            document.getElementById("position_inp").value = get_entity_position_string(
                document.getElementById("rendered" + annotation_id), false
                )
        } catch(e) {}
        document.getElementById("no_inp").value = get_number_from_string(annotation_id);
        document.getElementById("current_edited").innerHTML = annotation_id;

        /* annotation has gallery */
        if (document.getElementById("gal_wrapper" + annotation_id) != undefined) {
            // add button edit gallery
            document.getElementById("edit_gallery").classList.add("visible");
            // function edit gallery doesnt exist yet -- but it will be similar to createGallery
            
        } else {
            document.getElementById("make_gallery").classList.add("visible");
            // add button create gallery
        }

        // for each of languages
        for (lang in json_obj.languages) {
            if (json_obj.languages[lang] == "") continue;

            if (annotation_info.texts[lang].heading == undefined) annotation_info.texts[lang].heading = "";
            if (annotation_info.texts[lang].text == undefined) annotation_info.texts[lang].text = "";
            document.getElementById("heading_inp" + lang).value = annotation_info.texts[lang].heading;
            // put into editor
            Editor.append_html(lang, annotation_info.texts[lang].text);
        }
        open_popup("annotation_window", false);
        
    }

    /**
     * Deletes annotation -- parameter is the delete button node
     * and will remove its parent annotation.
     * @param {Node} button to delete
     */
    function delete_annotation(button) {
        // really?
        if (!confirm("Do you really want to erase annotation?")) return;
        var annotation_id = button.parentNode.id;
        var annotation_button = document.getElementById("rendered" + annotation_id);
        var annotation = document.getElementById(annotation_id);
        annotation_button.parentNode.removeChild(annotation_button);
        annotation.parentNode.removeChild(annotation);
        delete json_obj.annotations[annotation_id];
        // TODO save
        //save_to_local_storage();
    }

    /**
     * Saves information into user browsers local storage.
     */
    function save_to_local_storage() {
        var error_msg = "Couldnt save to local storage, something went wrong";
        try {
            console.log("should save");
            // get where to save to
            var key = get_local_location();
            if (key == null) {
                console.log(error_msg);
                return; // cannot save
            }
            window.localStorage.setItem(key, JSON.stringify(json_obj));
        } catch (e) {
            console.log(error_msg);
        }
        is_dirty = false;
    }

    /**
     * Gets location of local storage
     */
    function get_local_location() {
        var addr = location.search.slice(1, location.search.length);
        if (addr == "") {
            if ((addr = json_obj.path_name) == undefined) {
                console.log("Couldnt get local storage");
                return null;
            }
        }
        return addr;
    }

    /**
     * Small helper function
     * @param {*} string 
     */
    function get_number_from_string(string) {
        var r = /\d+/;
        return string.match(r);
    }

    /**
     * Easy input checking function for annotation form
     * @param {*} new_position 
     * @param {*} input_number 
     */
    function check_if_valid(new_position, input_number) {
        function color_input_red(input_node) {
            input_node.classList.add("wrong_input");
            input_node.addEventListener("focus", function () {
                input_node.classList.remove("wrong_input");
            });
        }

        if (!(cond1 = new_position.split(" ").length == 3)) {
            // wrong position
            color_input_red(document.getElementById("position_inp"));
        }
        if (!(cond2 = Number.isInteger(input_number))) {
            // is not number
            color_input_red(document.getElementById("no_inp"));
        }
        return cond1 && cond2;
    }

    /**
     * Writes changes into json_obj after closing the annotation window.
     */
    function save_changes() {
        var current_annotation = document.getElementById("current_edited").innerHTML;
        var new_position = document.getElementById("position_inp").value;
        var new_number = document.getElementById("no_inp").value;
        new_number = parseInt(new_number);
        //console.log(current_annotation);
        if (!check_if_valid(new_position, new_number)) {
            // write msg
            return;
        }
        // number change handling
        var new_id = "uniqueID" + new_number;
        // if new annotation
        var rendered_anno = document.getElementById("rendered" + current_annotation);
        if (rendered_anno == null) {
            // make it with id number_annotations + 1
            current_annotation = "uniqueID" + find_empty_id();
            make_new_annotation(new_position, current_annotation);
            // if that is the number we wanted -- were done
            if (current_annotation == new_id) {
                Editor.empty_editors();
                //$('#editor').trumbowyg('empty');
                close_windows();
                //save_to_local_storage();
                return;
            }
            // else -- continue executing
        }
        
        if (new_id in json_obj.annotations) {
            if (new_id != current_annotation) {
                // SWAP
                json_obj.annotations[current_annotation] = JSON.parse(JSON.stringify(json_obj.annotations[new_id])); // doing deep copy
                change_popup(current_annotation, json_obj.annotations[new_id]);
                current_annotation = new_id;
            }
        } else {
            delete json_obj.annotations[current_annotation];
            var rendered_annot = document.getElementById("rendered" + current_annotation);
            
            // just putting new number
            rendered_annot.setAttribute("id", "rendered"+new_id);
            rendered_annot.setAttribute("info-window", {window_id: new_id});
            rendered_annot.setAttribute("value", new_number + ".");
            document.getElementById(current_annotation).setAttribute("id", new_id);
            try {
                document.getElementById("edit" + current_annotation).setAttribute("id", "edit" + new_id);
            } catch (e) {}
            json_obj.annotations[new_id] = {};
            current_annotation = new_id;
        }
        //}
        json_obj.annotations[current_annotation].position = new_position;

        for (lang in json_obj.languages) {
            if (json_obj.languages[lang] == "") continue;
            json_obj.annotations[current_annotation].texts[lang].heading = document.getElementById("heading_inp" + lang).value;
            json_obj.annotations[current_annotation].texts[lang].text = $('#editor' + lang).trumbowyg('html');
        }
        
        // manipulate actual annotation
        change_popup(current_annotation, json_obj.annotations[current_annotation]);
        //$('#editor').trumbowyg('html', '');
        //$('#editor').trumbowyg('empty');
        Editor.empty_editors();

        // save into local storage
        //save_to_local_storage();
        // TODO TODO TODO  -- pri prepnuti jazyku se neprojevi!!!!!!!!!!
        document.getElementById("edit_gallery").classList.remove("visible");
        document.getElementById("make_gallery").classList.remove("visible");

        close_windows();
    }

    /** TODO -- multilanguage version!!!!
     * For building brand new annotation
     * @param {*} new_position 
     * @param {*} new_id 
     */
    function make_new_annotation(new_position, new_id) {
        var template_info = {
            "edit_mode" : true,
            "annotations" : {
                [new_id] : {
                    "heading" : document.getElementById("heading_inp").value,
                    "text" : $('#editor').trumbowyg('html'),
                    "position" : new_position,
                }
            }
        }
        App.put_template_to_html(template_info, "a-scene", Handlebars.templates.popup_button);
        App.put_template_to_html(template_info, "body", Handlebars.templates.popup);
        json_obj.annotations[new_id] = template_info.annotations[new_id];
        

        make_edit_button_apear(document.getElementById("delete" + new_id));
        make_edit_button_apear(document.getElementById("edit" + new_id));
    }


    /**
     * Makes the changes in the actual popup
     * @param {string} popup_id 
     * @param {object} annotation_info data
     */
    function change_popup(popup_id, annotation_info) {
        var lang = Language.language();
        document.querySelector("#" + popup_id + " span.heading_span").innerHTML = annotation_info.texts[lang].heading;
        document.querySelector("#" + popup_id + " span.popup_text").innerHTML = annotation_info.texts[lang].text;
        document.getElementById("rendered" + popup_id).setAttribute("position", annotation_info.position);
    }

    /**
     * Fires up annotation window for creating new popup
     */
    function create_new_popup() {
        var id = find_empty_id();
        build_annotation_window(null, "uniqueID" + id);
    }

    /**
     * Finds empty id for new popup window.
     */
    function find_empty_id() {
        var id = document.getElementsByClassName("clickable").length + 1;
        // non elegant solution to find empty id :D
        while (document.getElementById("uniqueID" + id) != null) {
            ++id;
        }
        return id;
    }

    /**
     * Discards changes and closes the annotation window.
     */
    function discard_changes() {
        if (!confirm("Do you really want to discard changes?")) return;
        //$('#editor').trumbowyg('empty');
        document.getElementById("edit_gallery").classList.remove("visible");
        document.getElementById("make_gallery").classList.remove("visible");
        Editor.empty_editors();
        close_windows();
    }

    /**
     * Function that lets user save json_obj into a json file on his device
     */
    function save_json() {
        //var a = document.createElement("a");
        //var file = new Blob([JSON.stringify(json_obj)], {type: "text/json"});
        //a.href = URL.createObjectURL(file);
        //a.download = "info.json";
        //a.click();
        // save to local storage
        //save_to_local_storage();
        //let data = JSON.stringify(json_obj);
        if (!is_dirty && Object.values(dirty).every(val => val == false)) return; // does not have to save when no change has been done
        if (dirty.rot) {
            // read rotation and set to json
            var rotation = document.getElementById("gltf_model").getObject3D("mesh").rotation;
            console.log(rotation);
            json_obj.player.model_rotation = radToDeg(rotation.x) + " " + radToDeg(rotation.y) + " " + radToDeg(rotation.z);
        }
        App.save_json();
        is_dirty = false;
    }

    /**
     * Returns fresh version from the web, if user is working on his own from data storage
     */
    function get_version_from_web() {
        delete_old_data();
        load_from_web_or_user(get_local_location());
    }

    function delete_old_data() {
        var annotations = document.getElementsByClassName("popup");
        for (let popup of annotations) {
            popup.parentNode.removeChild(popup);
        }
        var a_scene = document.querySelector("a-scene");
        a_scene.parentNode.removeChild(a_scene);
    }

    /**
     * Deletes local changes saved in data and refreshes page to get fresh data.
     */
    function delete_local_data() {
        // confirmation dialog
        if (!confirm("Opravdu chcete smazat lokální změny? Tato akce smaže z prohlížeče změny provedené v anotacích a\
        vyvolá načtení stránky s aktuálními údaji ze serveru. Pokud si chcete změny uložit, využijte tlačítka Uložit JSON.")) return;
        // delete local data
        window.localStorage.removeItem(get_local_location());
        // trigger page refresh
        location.reload();
    }

    /**
     * Puts annotation in front of camera view.
     * TODO -- make this work for orbit controls!!
     */
    function make_annot_in_front() {
        var newId = find_empty_id();
        var mockup_json = {
            "edit_mode" : true,
            "annotations" : {
                ["uniqueID" + newId] : {
                    "heading" : "",
                    "text" : "",
                    "position" : Object.values(getInFrontOfCameraPos(3)).reduce((bef, next) => bef + " " + next)
                }
            }
        }
        App.put_template_to_html(mockup_json, "a-scene", Handlebars.templates.popup_button);
        App.put_template_to_html(mockup_json, "body", Handlebars.templates.popup);
        json_obj.annotations[newId] = {
            "heading" : "",
            "text" : "",
            "texts": Language.getProvidedLanguage().reduce((prev, lang) => {
                prev[lang] = {heading : "", text : ""}
                return prev;
            }, {}),
            "position" : getInFrontOfCameraPos(3)
        }

        make_edit_button_apear(document.getElementById("delete" + newId));
        make_edit_button_apear(document.getElementById("edit" + newId));

        is_dirty = true;
        
    }


    // ---------- functions for GALLERY making --------------------------

    /**
     * Triggers new gallery creation
     */
    function makeNewGallery(event) {
        // get annotation id from event for gallery to come under TODO
        var id = document.getElementById("current_edited").innerHTML;
        // establish path to galleries
        var galName = Date.now();
        
        
        // create the gallery window with the needed data
        ipcRenderer.send("initGalleryWindow", {gallery_path: galName, annotation_obj : {}, empty_annot : emptyAnnot()});

        // wait for it to provide info about gallery whereabouts
        ipcRenderer.once("galleryCreated", function (e, gallery_info) {
            gallery_info.parent_id = id;
            
            json_obj.galleries.push(gallery_info);
            // save json
            ipcRenderer.send("save_json", json_obj);
            // reload -- maybe -- or more effective -- start only gallery
            //var el = document.getElementById('gal_wrapper' + id);
            //el.remove();
            GalleryControl.build_gallery(gallery_info);
        });
        

    }

    function editGallery(e) {
        var parentID = document.getElementById("current_edited").innerHTML;
        // find the gallery info
        var gallery_info = json_obj.galleries.filter((x) => {
            return x.parent_id == parentID
        })[0];


        console.log(__dirname);
        var pathWithoutFirst = gallery_info.json_gallery_src.split(/\/|\\/);
        pathWithoutFirst.splice(0,1);
        pathWithoutFirst = pathWithoutFirst.join("/");
        ipcRenderer.send("readRelative", pathWithoutFirst + "/dir_list.json");
        ipcRenderer.once("requestedFile", (e, file) => {
            console.log(file);
            var annotation_obj = file;

            ipcRenderer.send("initGalleryWindow", {
                gallery_path: gallery_info.json_gallery_src.split("/").pop(),
                annotation_obj : annotation_obj, 
                empty_annot : emptyAnnot()});
    
            // wait for it to provide info about gallery whereabouts
            ipcRenderer.once("galleryCreated", function (e, gallery_info) {
                gallery_info.parent_id = id;
                //json_obj.galleries[galName] = gallery_info;
                //console.log(gallery_info);
                // reload -- maybe -- or more effective -- start only gallery
                // save the main json
                //ipcRenderer.send("save_json", json_obj);
                var el = document.getElementById('gal_wrapper' + id);
                el.remove();
                console.log("removed");
                GalleryControl.build_gallery(gallery_info);
            });
        });

        

    }

    // inititate languages
    function emptyAnnot() {
        var eA = {};
        for (language in json_obj.languages) {
            if (json_obj.languages[language] == "") continue;
            eA[language] = "";
        }
        return eA;
    }

    function change_camera_begin_pos() {
        var posrot = get_entity_position_string(document.getElementById("camera"), true);
        json_obj.player.camera_position = posrot.split(" ").slice(0, 3).join(" ");
        json_obj.player.camera_rotation = posrot.split(" ").slice(-2).join(" ");
        is_dirty = true;
    }

    return {

        /**
         * Main function -- takes care of initiating the whole editing capabilities.
         */
        init_annotation_editor : function () {
            var key_comb_pressed = false;
            App.put_template_to_html(json_obj, "body", Handlebars.templates.annotation_window);
            
            console.log("Edit mode allowed.");
            //  TODO -- make this a normal thing directly in html -- also revise the buttons
            var extra_buttons = '<button class="ed_button button" id="back_to_main">Go to main menu</button>\
            <button class="ed_button button" id="new_empty_annot"> Insert new annotation (CTRL + N)</button>\
            <button class="ed_button button" id="rotate_model"> Toggle model rotation (CTRL + R) </button>\
            <button class="ed_button button" id="change_camera_begin_pos"> Set camera begin position and rotation to current values </button>';
            document.getElementById("control_panel").innerHTML += extra_buttons;
            Editor.init_editors();

            // catch ctrl + shift + e and turn on edit buttons
            /*document.addEventListener("keydown", function (zEvent) {
                if (zEvent.ctrlKey  &&  zEvent.shiftKey  &&  (zEvent.key === "e" || zEvent.key === "E")) {  // case sensitive
                    zEvent.preventDefault();
                    if (!key_comb_pressed){
                        key_comb_pressed = true;
                        make_edit_buttons_apear();
                        prevent_data_deletion();
                    }
                } else {}
            }, true);*/

            put_listeners();
        },

        make_annot_in_front : make_annot_in_front,
        make_edit_buttons_apear : make_edit_buttons_apear,
        makeNewGallery : makeNewGallery,
        editGallery: editGallery
    };
})();