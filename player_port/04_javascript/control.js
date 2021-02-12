document.addEventListener("template_done", function() {
    // HOME button functionality
    var camera = document.getElementById("camera");
    var homeButton = document.getElementById("home_button");
    if (homeButton != null) {
        homeButton.addEventListener("click", function() {
            camera.setAttribute("position", json_obj.player.camera_position);
        });
    }

/**
 * My first component, it changes the sky
 * CURRENTLT NOT USED
 */
AFRAME.registerComponent ('cursor-listener', {
    init: function() {
        this.el.addEventListener('click', function(event) {
            var sky = document.getElementById("sky");
            if (sky.getAttribute('src') == "#home") {
                sky.setAttribute('src', '#everest');
            } else {
                sky.setAttribute('src', '#home');
            }
        });
    }
});

/**
 * this component is used to change camera position, allowing for movement around the world
 * syntax in HTML: <a-sth change-position=' position : x y z' > </a-sth>
 * when the position atttribute is left out, the camera position will be changed to that of element
 * CURRENTLY NOT USED
 */
AFRAME.registerComponent ('change-position', {
    schema: {
        position: {type: 'string', default: ''}
    },
    init: function() {
        var data = this.data;
        var el = this.el;
        position = el.getAttribute('position');
        this.el.addEventListener('click', function(event) {
            var camera = document.getElementById('camera');
            var desired_position;
            if (data.position != "") {
                desired_position = data.position;
            } else { // action when no coordinates provided
                desired_position = el.getAttribute("position");
            }
            if (desired_position == camera.getAttribute('position')) {
                return;
            }

            var blinkTeleportationEls = document.querySelectorAll('[change-position]');
            for (var i = 0; i < blinkTeleportationEls.length; i++) {
                // RESET THE CLICKABLE VALUE FOR ALL THE BLINK-TELEPORTATION ELEMENTS
                blinkTeleportationEls[i].setAttribute('class', 'clickable');
                // THEN MAKE ONLY THE SELECTED BLINK-TELEPORTATION ELEMENT NOT-CLICKABLE
                el.setAttribute('class', 'not-clickable');
            }

            camera.setAttribute('position', desired_position);

            // TRYING ANIMATION TODO
            var animation = document.createElement("a-animation");
            animation.setAttribute("attribute","position");
            animation.setAttribute("to",desired_position);
            animation.setAttribute("dur","2000");
            animation.setAttribute("easing","linear");
            camera.appendChild(animation);
        });
    }
});


AFRAME.registerComponent('look-at-camera', {
    tick: function() {
        var camPos = document.getElementById("camera").components.camera.camera.getWorldPosition(new THREE.Vector3());
        this.el.object3D.lookAt(camPos);
    }
});



/** 
 * clickable component for popup window
*/
AFRAME.registerComponent ('info-window', {
    schema: {
        window_id: {type: 'string', default: ''}
    },
    update: function() {
        if (!this.el.classList.contains("clickable")) this.el.classList.toggle('clickable');
        //var raycasterEl = document.getElementById("a-scene").querySelector('[raycaster]');
        //raycasterEl.components.raycaster.refreshObjects();
        // SIMPLY WILL NOT WORK !!! :D
        //var raycaster = document.getElementById("raycaster");
        //if (raycaster != null) {
            //document.querySelector("a-scene").removeChild(raycaster);
            //raycaster.setAttribute("raycaster", "objects: .clickable");
            //document.querySelector("a-scene").appendChild(raycaster);
        //}
        var window_id = this.data.window_id;
        var shiftPressed = false;
        var shiftHeld = false;
        const el = this.el;
        var cancelControls = function (e) {
            if (e.code != "Escape") return;
            el.removeAttribute("transform-controls");

            if (json_obj.player.orbit_control) {
                // has to restart orbit control
                document.querySelector("[camera]").pause();
                document.querySelector("[camera]").components["orbit-controls"].controls.enabled = true
            }

            // saving into json
            json_obj.annotations[window_id].position = Object.values(el.getAttribute("position")).reduce((prev, cur) => prev + " " + cur);
            console.log(json_obj.annotations[window_id].position)
            shiftPressed = false;
            AnnotationWindow.set_dirty();
            el.setAttribute("opacity", "1");
            document.removeEventListener("keydown", cancelControls);
        };
        document.addEventListener('mousedown', function (e) { shiftHeld = e.shiftKey });
        this.el.addEventListener('click', function(evt) {
            if (document.getElementById(window_id) == null) return;
            //console.log(evt);
            if (!shiftHeld){
                if (shiftPressed) return;
                open_popup(window_id, false);
                // find out if there is gallery
                var window = document.getElementById(window_id);
                var galleries = window.getElementsByClassName("popup_body")[0].getElementsByClassName("gallery_wrapper");
                for (const gallery of galleries) {
                    GalleryControl.init_gallery(gallery); // function in gallery control
                }  
                
            } else {
                if (shiftPressed) {
                    // cancel the listeners
                    //cancelControls();
                    //document.removeEventListener("keydown", cancelControls);
                    return;
                }
                //console.log("Shift was pressed.");
                // shift was pressed -- therefore only change colour and allow for moving
                shiftPressed = true;
                el.setAttribute("opacity", "0.6");
                el.setAttribute("transform-controls", "");
                if (json_obj.player.orbit_control) document.querySelector("[camera]").components["orbit-controls"].controls.enabled = false;
                document.addEventListener("keydown", cancelControls);
            }
        });
    }
});

/**
 * Thin component wrapper around THREE.js transform controls. Needs to include:
 * <script src="../javascript_aframe/three.min.js"></script>
 * <script src="../javascript_aframe/TransformControls.js"></script>
 *  which actually had to come from an older version (because Aframe isnt using the newest version of three.js): https://github.com/mrdoob/three.js/blob/7a7d6e222bcf7b7b6eff48cf0e9132b6a236ce3b/examples/js/controls/TransformControls.js
 * Hope that this will not produce some compatibility issues in the future - it sshouldnt, unless I have to update
 * AFrame.
 */
AFRAME.registerComponent("transform-controls", {
    init: function () {
        var camera = document.querySelector("[camera]").getObject3D('camera');
        var renderer = document.querySelector('a-scene').renderer;
        var scene = document.querySelector('a-scene').object3D;
        var control = new THREE.TransformControls(camera, renderer.domElement);
        if (this.el.id == "gltf_model") control.mode = "rotate"; // rotate the model
        control.addEventListener('change', function (){ renderer.render(scene, camera)});
        if (this.el.id == "gltf_model") control.attach(this.el.getObject3D("mesh"));
        else control.attach(this.el.object3D);
        scene.add(control);
        this.scene = scene;
        this.control = control;
    },

    remove: function () {
        this.control.detach();
        this.scene.remove(this.control);
    }
});



// TODO -- rewrite into component, also use the shift click detection -- make it general
document.getElementById("gltf_model").addEventListener("click", (evt) => {
    if (evt.shiftKey) {
        if (evt.target.getAttribute("transform-controls") == null) evt.target.setAttribute("transform-controls", "");
        else evt.target.removeAttribute("transform-controls"); 
    }
});



/**
 * NOT USED
 */
function setupMoveListeners(element) {
    
    //console.log(element);

    /* isnt needed anymore, when I have the cool transform controls!!!
    moveObject = function (e) {
        // TODO  -- make movement relative to the camera!!!!
        // meaning get vector between camera view and object -- only in the beginning!!
        e.stopPropagation();
        var moveConst = 0.2
        
        // get camera position
        //var cameraPos = document.getElementById("camera").object3D.position;
        //var vectorToCamera = element.object3D.position.sub(cameraPos).normalize();
        switch (e.code) {
            case "KeyW":
                if (e.shiftKey) {
                    element.object3D.position.y += moveConst;
                } else {
                    element.object3D.position.z += moveConst;
                }
                break;
            case "KeyS":
                if (e.shiftKey) {
                    element.object3D.position.y -= moveConst;
                } else {
                    element.object3D.position.z -= moveConst;
                }
                break;
            case "KeyA":
                element.object3D.position.x -= moveConst;
                break;
            case "KeyD":
                element.object3D.position.x += moveConst;
        
        }
    }
    document.addEventListener("keydown", moveObject);*/
}

// NOT USED
function cancelMoveListeners(element) {
    // TODO -- maybe get rid of those functions as they are short anyways
    // cancel listeners
    element.removeAttribute("transform-controls");
    // TODO update JSON with the new position of annotation
    
}

/** NOT USED
 * Adds movement arrows to the element.
 */
function addArrows(element) {
    var aframe = document.querySelector("a-scene");
    aframe.appendChild(createArrow(element.getAttribute("position"), "nn"));
}

/** NOT USED
 * Function that creates a single arrow. Returns the HTML node that will be appended to ascene.
 * @param {string} position string of the beginning of arrow
 * @param {string} direction vector of arrow
 * @param {string} color hexacode of color (three digits)
 */
function createArrow(position, direction, color) {
    var arrow = document.createElement("a-entity");
    arrow.setAttribute("position", position);
    arrow.setAttribute("arrow", "color: "+ color +"; direction: "+ direction);
    return arrow;
}



/**
 * For loading screen to know when to end.
 */
AFRAME.registerComponent('big_model', {
    init: function() {
        var el = this.el;

        // CAMERA POSITION ROTATION SETUP -- here cause I couldnt be bothered with creating new component
        if (json_obj.player.camera_rotation != null) {
            if (json_obj.player.orbit_control) {

            } else {
                ControlPanel.go_to_position(null, json_obj.player.camera_position + " " + json_obj.player.camera_rotation);
            }
        }

       this.el.addEventListener('model-loaded', e => {
           document.querySelector("#loading_screen").remove();
           console.log("Should see model");
       });
       this.el.addEventListener("model-progress", function(e) {
        //console.log(e.progress);
      });
       this.el.addEventListener('model-error', e => {
        //document.querySelector("#loading_screen").remove();
        console.log("Error in loading model");
        });
    }
 });



/**
 * Autoscaling component - centers gltf model and scales it.
 * If you use it, note that rotation has to be inserted via this component.
 */
AFRAME.registerComponent('autoscale', {
    schema: {
        scale: {
            type: 'number', default: 1
        },
        rotation: {
            type: 'vec3', default: "0 0 0"
        }
    },
    init: function () {
      this.scale();
      this.el.addEventListener('object3dset', () => this.scale());
    },
    scale: function () {
      const el = this.el;
      const span = this.data.scale;
      const rotation = this.data.rotation;
      const mesh = el.getObject3D('mesh');
  
      if (!mesh) return;
      // Rotation - IN RADIANS!!
      mesh.rotation.set(degToRad(rotation.x), degToRad(rotation.y), degToRad(rotation.z));
      //mesh.rotation.set(-Math.PI/2, 0, Math.PI*0.61);
      // Compute bounds.
      const bbox = new THREE.Box3().setFromObject(mesh);
  
      // Normalize scale.
      const scale = span / bbox.getSize().length();
      mesh.scale.set(scale, scale, scale);
      //mesh.rotation.set(90, 0, 35);
  
      // Recenter.
      const offset = bbox.getCenter().multiplyScalar(scale);
      mesh.position.sub(offset);
    }
  });

});

function degToRad(degrees) {
  return degrees * (Math.PI/180);
}

function radToDeg(radians) {
    return radians * (180/Math.PI);
}


/**
 * Gets the string representing position and rotation if specified of the aframe camera.
 * @param {Boolean} rotation if you want to get rotation
 */
function get_camera_position_string(rotation) {
    var entity = document.getElementById("camera");
    var posrot = "";
    var pos = new THREE.Vector3();
    if (json_obj.player.orbit_control) {
        entity.components.camera.camera.getWorldPosition(pos); // TODO check if I am using this function in other than camera context..
    } else pos = entity.getAttribute("position");
    //var pos = entity.getAttribute("position");
    console.log("POS" + pos);
    if (pos == null) return posrot;
    posrot = toFixedTruncate(pos.x, 3) + " " + toFixedTruncate(pos.y, 3) + " " + toFixedTruncate(pos.z, 3);
    if (rotation) {
        try {
            var rot_x = entity.components['touch-controls'].pitchObject.rotation.x;
            var rot_y = entity.components['touch-controls'].yawObject.rotation.y;
            posrot += " " + toFixedTruncate(rot_x, 3) + " " + toFixedTruncate(rot_y, 3);
        } catch(e) {
            posrot += " 1 1" 
        }
        
    }
    console.log("posrot: " + posrot);
    return posrot;
}

 /**
     * Helper function for cutting off too long floats.
     * Shortens them to precision and truncates trailing zeroes.
     * @param {*} no 
     * @param {*} precision 
     */
function toFixedTruncate(no, precision) {
    return parseFloat(no.toFixed(precision));
}


function getCameraFaceDirection() {
    var direction = new THREE.Vector3();
    document.getElementById("camera").sceneEl.camera.getWorldDirection(direction);
    return direction;
}

/**
 * TODO -- change the name of the function into what it actually does -- or consider splitting it, as would naturally occur
 * @param {*} howFar 
 */
function getInFrontOfCameraPos(howFar) {
    var cameraDirection = getCameraFaceDirection();
    var cameraPosition = document.getElementById("camera").components.camera.camera.getWorldPosition(); // updated to world position -- otherwise was local orbit controls pos
    
    var noorbit = () => {
        // in case of normal controls, this is done
        var newPos = {};
        newPos.x = cameraPosition.x + howFar*cameraDirection.x
        newPos.y = cameraPosition.y + howFar*cameraDirection.y 
        newPos.z = cameraPosition.z + howFar*cameraDirection.z
        return newPos;
    };

    if (json_obj.player.orbit_control) { // put them some distance away from the model, on the vector leading to camera global position
        var ray = new THREE.Raycaster(cameraPosition, cameraDirection.clone());
        var rayIntersects = ray.intersectObject(document.getElementById("gltf_model").object3D, true);
        if (rayIntersects.length == 0) return noorbit();
        var intersection = rayIntersects[0].point;

        var newPos = {};
        newPos.x = intersection.x - howFar*cameraDirection.x
        newPos.y = intersection.y - howFar*cameraDirection.y 
        newPos.z = intersection.z - howFar*cameraDirection.z
        return newPos;
    }
    return noorbit();
}

    

