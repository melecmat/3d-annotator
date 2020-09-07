/**
 * Creates A-frame representation of popup 
 * @param {*} id 
 * @param {*} position in A-Frame
 * @param {*} gallery specifies if it is gallery or simple text popup
 */
function create_popup(id, position, gallery) {
    var ascene = document.querySelector("a-scene");
    var without_number = false;
    var regex = /\d+/;
    var popup_no = id.match(regex);
    if (popup_no == null) {
        without_number = true;
    } else {
        var popup_visual = document.createElement("a-text");
        //popup_no = gallery ? popup_no + "." : romanize(popup_no); // let descriptions have roman numbers
        popup_no = popup_no + ".";
        popup_visual.setAttribute("value", popup_no);
        popup_visual.setAttribute("width", "6");
        popup_visual.setAttribute("align", "center");
        popup_visual.setAttribute("xOffset", "10");
    }
    if (without_number) {
        var popup_visual = document.createElement("a-image");
        popup_visual.setAttribute("width", "0.4");
        popup_visual.setAttribute("height", "0.4");
    }
    popup_visual.setAttribute("look-at", "[camera]");
    popup_visual.setAttribute("color", "white");
    
    popup_visual.setAttribute("id", "rendered" + id);
    popup_visual.setAttribute("class", "clickable");
    popup_visual.setAttribute("info-window", " window_id:" + id);
    popup_visual.setAttribute("position", position);
    
    if (!gallery && without_number)
        popup_visual.setAttribute("src", "../../control_graphic/info_logo.png"); 
    else if  (without_number)
        popup_visual.setAttribute("src", "../../control_graphic/gallery_logo.png");
    ascene.appendChild(popup_visual);
}

function open_popup(window_id, do_not_close) {
    if (!do_not_close) {
        var previous = document.querySelector(".visible .popup");
        if (previous != undefined) {
            previous.classList.remove("visible");
        }
    }
    var window = document.getElementById(window_id);
    window.classList.add("visible");
}

function close_windows() {
    var popup = document.getElementsByClassName('popup');
    for (var l = 0; l < popup.length; l++) {
        popup[l].classList.remove('visible');
    }
    document.onkeydown = null;
}

/**
 * For minimizing windows
 */
document.addEventListener("template_done", function() {
    var back_icon = document.getElementsByClassName('back_icon');
    for (var i = 0; i < back_icon.length; i++) {
        back_icon[i].addEventListener('click', close_windows);
    }
});

