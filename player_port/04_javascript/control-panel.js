

/**
 * Wrapping functions used in control panel.
 */
var ControlPanel = (function () {


    // event listeners for reading values of the control panel
    document.addEventListener("template_done", function () {
        var body = document.querySelector('body');
        body.addEventListener('click', function(event) {
            if (event.target.id == "control_trigger") trigger_menu();
            else if (event.target.id == "copy_pos") copy_position_rotation();
            else if (event.target.id == "goto_pos") go_to_position();
            else if (event.target.id == "help") {
                console.log("opening help");
                ipcRenderer.send("openHelp", null);
            }
        });

        body.addEventListener("change", function() {
            if (event.target.parentElement.id == "change_visibility") change_popup_visibility();
            else if (event.target.parentElement.id == "switch_gyro") switch_gyroscope();
            else if (event.target.id == "lang_switch") Language.swapLanguageVersion(event.target.value);
        });

        body.addEventListener("input", function() {
            if (event.target.classList.contains("speed_slider")) change_acceleration(event);
        });

        //document.getElementById("control_trigger").addEventListener("click", trigger_menu);
        //document.getElementById("change_visibility").addEventListener("change", change_popup_visibility);
        //document.getElementById("switch_gyro").addEventListener("change", switch_gyroscope);
        //document.querySelector("div#speed .speed_slider").addEventListener("input", change_acceleration);
        //document.getElementById("copy_pos").addEventListener("click", copy_position_rotation);
        //document.getElementById("goto_pos").addEventListener("click", go_to_position);
        register_enter();
        console.log("added listeners");
    });

    /**
     * Menu sliding
     */
    function trigger_menu() {
        var trigger = document.getElementById("control_trigger");
        var panel = document.getElementById("control_panel");
        if (panel.classList.contains("triggered")) {
            trigger.classList.remove("triggered");
            panel.classList.remove("triggered");
            trigger.setAttribute("src", "../../control_graphic/right.png");
        } else {
            trigger.classList.add("triggered");
            panel.classList.add("triggered");
            trigger.setAttribute("src", "../../control_graphic/back_icon.png");
        }
    }

    /**
     * Implements the functionality of making descriptions in A-Frame invisible/visible
     */
    function change_popup_visibility() {
        var popups = document.getElementsByClassName("clickable");
        if (popups[0].getAttribute("visible") == false) {
            for (var i = 0; i < popups.length; ++i) {
                popups[i].setAttribute("visible", true);
            }
        } else {
            for (var i = 0; i < popups.length; ++i) {
                popups[i].setAttribute("visible", false);
            }
        }
    }

    /**
     * Turns gyroscope on mobile on or off. 
     */
    function switch_gyroscope() {
        var camera = document.getElementById("camera");
        var properties = camera.getAttribute("touch-controls");
        if (properties.gyroEnabled == true) {
            properties.gyroEnabled = false;
        } else {
        properties.gyroEnabled = true
        }
        camera.setAttribute("touch-controls", properties);
    }

    /**
     * For changing the velocity of camera.
     * Should be listening to change of speed slider
     */
    function change_acceleration(input) {
        var acceleration = input.target.value;
        document.getElementById("speed_val").innerHTML = acceleration;
        var camera = document.getElementById("camera");
        //var acceleration = camera.getAttribute("wasd-controls");
        //acceleration = parseInt(acceleration.match(/\d+/)[0] );
        //acceleration += delta;
        camera.setAttribute("wasd-controls", " fly:true; acceleration:" + acceleration);
    }

    /**
     * Copies current camera position.
     * Will be in a listener.
     */
    function copy_position_rotation() {
        var posrot = get_entity_position_string(document.getElementById("camera"), true);
        // for copying text into clipboard
        const el = document.createElement('textarea');
        el.value = posrot;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
    }

    /**
     * Enables jump to position specified in a form field.
     * Or to position provided as a function argument
     */
    function go_to_position(e, posrot="") {
        var camera = document.getElementById("camera");
        if (posrot == "") {
            posrot = document.getElementById("user_pos").value;
        }
        //console.log(posrot);
        var pos_array = posrot.split(" ");
        if (pos_array.length != 5) {
            // wrong input
            // TODO -- upon wrong input tell the user
            return;
        }
        var pos = camera.getAttribute("position");
        newX = parseFloat(pos_array[0]);
        newY = parseFloat(pos_array[1]);
        newZ = parseFloat(pos_array[2]);
        rotX = parseFloat(pos_array[3]);
        rotY = parseFloat(pos_array[4]);
        if (isNaN(newX) || isNaN(newY) || isNaN(newZ) || isNaN(rotX) || isNaN(rotY)) {
            // wrong input
            return;
        }
        pos.x = newX;
        pos.y = newY;
        pos.z = newZ;

        //var succ = false;
        //while (!succ) {
        //    try {
                camera.components['touch-controls'].pitchObject.rotation.x = rotX;
                camera.components['touch-controls'].yawObject.rotation.y = rotY;
        //    } catch (e) {}
        //}
        
    }

    function register_enter() {
        var body = document.querySelector("body");

        // Execute a function when the user releases a key on the keyboard
        body.addEventListener("keyup", function(event) {
            if (event.target.id != "user_pos") {
                return;
            }
            // Number 13 is the "Enter" key on the keyboard
            if (event.keyCode === 13) {
                // Cancel the default action, if needed
                event.preventDefault();
                // Trigger the button element with a click
                document.getElementById("goto_pos").click();
            }
        });
    }

    

    

    return {
        go_to_position: go_to_position
    }

})();