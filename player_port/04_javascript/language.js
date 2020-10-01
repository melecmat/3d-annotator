/**
 * Module for working with language versions.
 */
var Language = (function () {
    var supportedLanguages = ["en", "cs", "de"];
    var lang = "en"; // default language

    function language () { return lang; }

    function setLanguage (l) {
        if (supportedLanguages.includes(l)) lang = l; // change only with valid lang
    }

    // cookie helper functions 
    var Cookie = (function () {
        return {
            setCookie(name,value,days) {
                var expires = "";
                if (days) {
                    var date = new Date();
                    date.setTime(date.getTime() + (days*24*60*60*1000));
                    expires = "; expires=" + date.toUTCString();
                }
                document.cookie = name + "=" + (value || "")  + expires + "; path=/";
            },
        
            getCookie(name) {
                var nameEQ = name + "=";
                var ca = document.cookie.split(';');
                for(var i=0;i < ca.length;i++) {
                    var c = ca[i];
                    while (c.charAt(0)==' ') c = c.substring(1,c.length);
                    if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
                }
                return null;
            }
        };
    })();

    /**
     * Function that determines language using users cookies and web preferences
     */
    function determineLanguage() {
        var newL;
        if ((newL = Cookie.getCookie("lang" + window.location.search)) != null) { // some already set language
            lang = newL;
            prepareData();
            return;
        } 

        // fallback if no language specified in older json versions
        if (json_obj.languages == null) {
            lang = "cs"; // change to en eventually - when migrated
            return;
        }

        // else see if some enabled language is preferred on the system
        var preferredLanguage = window.navigator.userLanguage || window.navigator.language;
        preferredLanguage = preferredLanguage.split("-")[0]; // to get rid of en-AU en-US etc
        if (json_obj.languages[preferredLanguage] != "" && json_obj.languages[preferredLanguage] != null) { // TODO -- not sure about the null checks
            lang = preferredLanguage;
            prepareData();
            return;
        }
        // if not, just pick first enabled language
        for (l of supportedLanguages) {
            if (json_obj.languages[l] != null && json_obj.languages[l] != "") { // TODO
                lang = l;
                prepareData();
                return;
            }
        }
    }

    // swaps language versions
    function swapLanguageVersion(language) {
        // set cookie to desired language
        Cookie.setCookie("lang" + window.location.search, language, 365);
        // save json
        App.save_json();

        // reload webpage
        location.reload();
    }

    /**
     * Returns array of language names that are allowed in the JSON
     */
    function getProvidedLanguage () {
        var ret = [];
        for (l in json_obj.languages) {
            if (json_obj.languages[l] != "") {
                ret.push(l);
            }
        }
        return ret;
    }

    /**
     * Function that translates app user interface
     * @param {String} toTranslate -- key to translation that I want to get
     */
    function translate (toTranslate) {
        return Translations.en[toTranslate]; // THIS IS BECAUSE WE WANT ONLY ENGLISH IN THE INTERFACE ON DESKTOP
        // IN THE WEB VERSION THIS FUNCTION IS Translations[lang][toTranslate];
    }

    function prepareData() {
        json_obj.title = json_obj.languages[lang];
        parseComments();
    }

    function selectGalleryLanguage(gallery_obj) {
        if (json_obj.languages == null) return;
        for (pic in gallery_obj) {
            gallery_obj[pic] = gallery_obj[pic][lang];
            if (gallery_obj[pic] == undefined) gallery_obj[pic] = "";
        }
    }

    /**
     * Parses comments that have multi language version -- picks the required language
     */
    function parseComments() {
        for (id in json_obj.annotations) {
            annotation = json_obj.annotations[id];
            annotation.heading = annotation.texts[lang].heading;
            annotation.text = annotation.texts[lang].text;
        }
    }

    return {
        language: language,
        setLanguage: setLanguage,
        determineLanguage: determineLanguage,
        swapLanguageVersion: swapLanguageVersion,
        translate : translate,
        getProvidedLanguage : getProvidedLanguage,
        selectGalleryLanguage : selectGalleryLanguage
    };
})();