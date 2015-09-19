/*
 * @author tamarintech / https://tamarintech.com
 *
 * Description: Early release of an AMF Loader following the pattern of the
 * example loaders in the three.js project
 *
 * Usage:
 *  var loader = new AMFLoader();
 *  loader.load('/path/to/project.amf', function(amfobjects) {
      for(amfobject in amfobjects) {
 *      scene.add(amfobject);
 *    }
 *  });
 *
 * Materials now supported, material colors supported
 * No support for colors (yet)
 * Zip support, requires jszip
 *
 */

AMFLoader = function(manager) {
  this.manager = (manager !== undefined) ? manager : THREE.DefaultLoadingManager;
};

AMFLoader.prototype = {

  constructor: AMFLoader,

  load: function(url, onLoad, onProgress, onError) {
    var scope = this;

    var loader = new THREE.XHRLoader(scope.manager);
    loader.setCrossOrigin(this.crossOrigin);
    loader.setResponseType('arraybuffer');

    loader.load(url, function(text) {
      var result = scope.parse(text);
      onLoad(result);
    }, onProgress, onError);
  },

  parse: function(data) {
    "use strict";

    var amfobject = {
      "name": "AMF Default Name",
      "author": "",
      "scale": 1.0,
      "materials": {},
      "objects": {}
    };

    var xmldata = this.loaddocument(data);

    amfobject.scale = this.loaddocumentscale(xmldata);

    var documentchildren = xmldata.documentElement.children;

    for(var i = 0; i < documentchildren.length; i++) {
      if(documentchildren[i].localName === 'metadata') {
        if(documentchildren[i].attributes['type'] !== undefined) {
          if(documentchildren[i].attributes['type'].value === 'name') {
            amfobject.name = documentchildren[i].textContent;
          } else if(documentchildren[i].attributes['type'].value === 'author') {
            amfobject.author = documentchildren[i].textContent;
          }
        }
      } else if(documentchildren[i].localName === 'material') {
        var loadedmaterial = this.loadmaterials(documentchildren[i]);
        amfobject.materials[loadedmaterial.id] = loadedmaterial.material;
      } else if(documentchildren[i].localName === 'object') {
        var loadedobject = this.loadobject(documentchildren[i]);
        amfobject.objects[loadedobject.id] = loadedobject.object;
      }
    }

    console.log(amfobject);
    return amfobject;
  },

  loaddocument: function ( data ) {
    var view = new DataView(data);

    var magic = String.fromCharCode(view.getUint8(0), view.getUint8(1));

    if(magic === "PK") {
      console.log("Loading Zip");
      var zip = null;
      var file = null;

      try {
        zip = new JSZip(data);
      } catch (e) {
        if (e instanceof ReferenceError) {
          console.log("  jszip missing and file is compressed.");
          return false;
        }
      }

      for(file in zip.files) {
        if(file.toLowerCase().endsWith(".amf")) {
          break;
        }
      }

      console.log("  Trying to load file asset: " + file);
      view = new DataView(zip.file(file).asArrayBuffer());
    }

    var filetext = new TextDecoder('utf-8').decode(view);

    var xmldata = new DOMParser().parseFromString(filetext, 'text/xml');

    if(xmldata.documentElement.nodeName.toLowerCase() !== "amf") {
      console.log("  Error loading AMF - no AMF document found.");
      return false;
    }

    return xmldata;
  },

  loaddocumentscale: function ( xmldata ) {
    var scale = 1.0;

    var unit = xmldata.documentElement.attributes['unit'].value.toLowerCase();

    var scale_units = {
      'millimeter': 1.0,
      'inch': 25.4,
      'feet': 304.8,
      'meter': 1000.0,
      'micron': 0.001
    };

    if(scale_units[unit] !== undefined) {
      scale = scale_units[unit];
    }

    console.log("  Unit scale: " + scale);
    return scale;
  },

  loadmaterials: function ( node ) {
    var mat = node;

    var loadedmaterial = null;
    var matname = "AMF Material";
    var matid = mat.attributes['id'].textContent;
    var color;

    for(var i = 0; i < mat.children.length; i++) {
      var matchildel = mat.children[i];

      if(matchildel.localName === "metadata" && matchildel.attributes['type'] !== undefined) {
        if(matchildel.attributes['type'].value === 'name') {
          matname = matchildel.textContent;
        }
      } else if(matchildel.localName === 'color') {
        color = this.loadcolor(matchildel);
      }
    }

    loadedmaterial = new THREE.MeshPhongMaterial({
      shading: THREE.FlatShading,
      color: new THREE.Color(color.r, color.g, color.b),
      name: matname});

    if(color.opacity !== 1.0) {
      loadedmaterial.transparent = true;
      loadedmaterial.opacity = color.opacity;
    }

    return { 'id': matid, 'material': loadedmaterial };
  },

  loadcolor: function ( node ) {
    var color = {'r': 1.0, 'g': 1.0, 'b': 1.0, 'a': 1.0, opacity: 1.0};

    for(var i = 0; i < node.children.length; i++) {
      var matcolor = node.children[i];

      if(matcolor.localName === 'r') {
        color.r = matcolor.textContent;
      } else if(matcolor.localName === 'g') {
        color.g = matcolor.textContent;
      } else if(matcolor.localName === 'b') {
        color.b = matcolor.textContent;
      } else if(matcolor.localName === 'a') {
        color.opacity = matcolor.textContent;
      }
    }

    return color;
  },

  loadobject: function ( node ) {
    var objid = node.attributes['id'].textContent;
    var loadedobject = { "name": "amfobject",
      "color": null,
      "volumes": []
    };

    document.loadedobject = node;

    var currnode = node.firstElementChild;

    while( currnode !== null ) {
      if(currnode.localName === "metadata") {
        if(currnode.attributes['type'] !== undefined) {
          if(currnode.attributes['type'].value === 'name') {
            loadedobject.name = currnode.textContent;
          }
        }
      } else if(currnode.localName === "color") {
        loadedobject.color = this.loadcolor(currnode);
      } else if(currnode.localName === "mesh") {
        var currmeshnode = currnode.firstElementChild;
        while( currmeshnode !== null ) {
          if(currmeshnode.localName === "vertices") {
            "pass";
          } else if(currmeshnode.localName === "volume") {
            "pass";
          }
          currmeshnode = currmeshnode.nextElementSibling;
        }
      }
      currnode = currnode.nextElementSibling;
    }

    return { 'id': objid, 'object': loadedobject };
  }
};