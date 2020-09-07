/**
 * My custom glTF model loader.
 */
AFRAME.registerComponent('my-gltf-model', {
    schema: {type: 'model'},
  
    init: function () {
      var dracoLoader = new THREE.DRACOLoader;
      dracoLoader.setDecoderPath( "../draco/" );
      //console.log(dracoLoader);
      this.model = null;
      this.loader = new THREE.GLTFLoader();
      if (dracoLoader) {
        this.loader.setDRACOLoader(dracoLoader);
      }
    },
  
    update: function () {
      var self = this;
      var el = this.el;
      var src = this.data;
  
      if (!src) { return; }
  
      this.remove();
  
      this.loader.load(src, 
        function gltfLoaded (gltfModel) {
            self.model = gltfModel.scene || gltfModel.scenes[0];
            self.model.animations = gltfModel.animations;
            el.setObject3D('mesh', self.model);
            el.emit('model-loaded', {format: 'gltf', model: self.model});
      },
      function onProgress(xhr) {
        //console.log(Math.floor(xhr.loaded / xhr.total * 100));
        try {
          if (xhr.lengthComputable) {
            contentLength = xhr.total;
          } else {
            contentLength = xhr.target.getResponseHeader('x-decompressed-content-length');
            contentLength = parseInt(contentLength);
          }
          var to_print = Math.floor(xhr.loaded / contentLength * 100);
          if (isNaN(to_print)) {
            to_print = Math.floor((xhr.loaded/1000000)) + " MB";
          }
          //console.log("To print: " + to_print);
          document.getElementById("progress").innerText = to_print;
        } catch (e) {console.log("Not present loading screen.");}
        
        el.emit("model-progress", {progress: ( xhr.loaded / xhr.total * 100 ) })
     },
     function gltfFailed (error) {
        var message = (error && error.message) ? error.message : 'Failed to load glTF model';
        el.emit('model-error', {format: 'gltf', src: src});
      });
    },
  
    remove: function () {
      if (!this.model) { return; }
      this.el.removeObject3D('mesh');
    }
  });