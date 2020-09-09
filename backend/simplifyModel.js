const obj2gltf = require('obj2gltf');
const fs = require('fs');
const gltfPipeline = require('gltf-pipeline');
const fsExtra = require('fs-extra');

// TODO!!!!!
function simplifyModel(modelPath, newPath) {
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

        processGltf(gltf, options)
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
            gltfToGlb(gltf)
            .then(function(results) {
                fsExtra.writeFileSync('model.glb', results.glb);
            });

        });

    });
    // TODO -- should work the same as obj2optimizedGlb
}