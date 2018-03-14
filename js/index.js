// Some global settings
// 0= No frames, 1= Keyframes only, 2= All frames
var SHOW_FRAMES =2 
// 0= Perspective, 1= Orthographic
var CAMERA_SWITCH = 1
var MANUAL_PLAYBACK = false
var SET_KEYFRAMES = false
var SHOW_OUTLINE = false
var STATIC = true

var luxo
var LuxoClass
var AnimData
var gui = new dat.GUI();

var AnimDataClass = function() {

    this.num_sequences=1;
    this.animation_length=1;

    this.current_sequence=0;
    this.current_frame_index=0;
    this.current_keyframe_index=0;
    this.base_x = 0
    this.base_y = 0.144
    this.base_ori = -0.0355
    this.leg_angle = 0.64
    this.neck_angle = 0.47
    this.head_angle = -0.0313

    this.current_keyframes=[];
    this.current_frames=[];


    this.all_keyframes=[];
    this.all_predictions=[];

    this.persistentFrame_models=[];

    this.set_all_predictions = function(data) {
        console.log("Setting predictions")
        this.all_predictions = data
        this.num_sequences = this.all_predictions.length
        this.current_frames = this.all_predictions[this.current_sequence]
    };

    this.set_keyframes = function(data) {
        console.log("Setting keyframes")
        // Put keyframes into absolute indexing
        this.all_keyframes = data.map(keyframes => {
          // keyframes is a list of "gaps"
          let acc = 0
          keyframes = keyframes.map(cur => {
            acc = acc + cur + 1
            return acc
          })
          keyframes.unshift(0) // Prepend 0 for first keyframe
          return keyframes
        })
        this.current_keyframes = this.all_keyframes[this.current_sequence]
        this.animation_length = this.current_keyframes[this.current_keyframes.length-1]+1
    };

    this.clearFrameModels = function() {
        while (this.persistentFrame_models.length > 0) {
            var frame = this.persistentFrame_models.pop()
            scene.remove(frame.model)
        }
    };

    this.nextFrame = function() {
        this.current_frame_index = (this.current_frame_index + 1) % this.animation_length  
    };
    this.prevFrame = function() {
        this.current_frame_index = Math.max(this.current_frame_index - 1,0) % this.animation_length  
    };
    this.nextSequence = function() {
        this.current_sequence = (this.current_sequence + 1) % this.num_sequences  
        this.current_frames = this.all_predictions[this.current_sequence]
        this.current_keyframes = this.all_keyframes[this.current_sequence]
        this.current_frame_index = 0
        this.current_keyframe_index = 0
        this.clearFrameModels()
    };
    this.prevSequence = function() {
        this.current_sequence = Math.max((this.current_sequence-1),0) % this.num_sequences  
        this.current_frames = all_predictions[this.current_sequence]
        this.current_keyframes = all_keyframes[this.current_sequence]
        this.current_frame_index = 0
        this.current_keyframe_index = 0
        this.clearFrameModels()
    };
    this.atEndOfSequence = function() {
        return (this.current_frame_index == (this.animation_length-1))
    };
    this.atKeyFrame = function() {
        return (this.current_frame_index == this.current_keyframes[this.current_keyframe_index - 1])
    };
    this.addPersistentFrame = function(luxo_arguments) {
        var persistentFrame = new LuxoClass(...luxo_arguments)
        persistentFrame.setState(...this.current_frames[this.current_frame_index])
        this.persistentFrame_models.push(persistentFrame)
        scene.add(persistentFrame.model)
    };

    this.getCurrentPose = function() {
        pose = this.current_frames[this.current_frame_index]
        this.base_x = pose[0]
        this.base_y = pose[1] 
        this.base_ori = pose[2] 
        this.leg_angle = pose[3] 
        this.neck_angle = pose[4] 
        this.head_angle = pose[5] 
        return pose
    };

    this.getDisplayColorArguments = function () {
        var luxo_arguments
        if (this.current_frame_index == this.current_keyframes[this.current_keyframe_index]) {
          luxo_arguments = [
            keyframeMaterial,
            outlineMaterial,
            false, //castShadow,
          ]
          this.current_keyframe_index += 1
        } else {
          luxo_arguments = [
            inbetweenMaterial,
            outlineMaterial,
            false, //castShadow,
          ]
        }
        return luxo_arguments
    };
}
    
  // Define render logic ...

var material = new THREE.MeshToonMaterial({
  color: 0xabb8cc,
  transparent: false,
  opacity: 0.0,
})
var keyframeMaterial = new THREE.MeshToonMaterial({
  color: 0xff6666,
  transparent: true,
  opacity: 0.5,
})
var inbetweenMaterial = new THREE.MeshToonMaterial({
  color: 0xabb8cc,
  transparent: true,
  opacity: 0.25,
})
var outlineMaterial = new THREE.LineBasicMaterial({
  color: 0x000000,
  linewidth: 2,
})


var animate = function() {
  for (var i in gui.__controllers) {
    gui.__controllers[i].updateDisplay();
  }
  if (AnimData.atEndOfSequence()){
    if(STATIC){
      PAUSED = true 
    } else {
      AnimData.clearFrameModels()
      requestAnimationFrame(animate)
    }
  } else {
      requestAnimationFrame(animate)
  }
  // Spread syntax just turns array into comma separate list
  luxo_states = AnimData.getCurrentPose()
  luxo.setState(...luxo_states)
  // Draw persistent keyframes
  luxo_arguments = AnimData.getDisplayColorArguments()
  // Javascript apparently doesn't have named arguments
  // One way to is make constructor to take an object
  if (
    // Show all
    SHOW_FRAMES == 2 ||
    // Show keyframes
    (SHOW_FRAMES == 1 && AnimData.atKeyFrame())
  ) {
    AnimData.addPersistentFrame(luxo_arguments)
    // Add to list, so we can clean later
  }

  if (SHOW_OUTLINE) {
    material.visible = false
    keyframeMaterial.visible = false
    inbetweenMaterial.visible = false      
    outlineMaterial.visible = true
  } else {
    material.visible = true
    keyframeMaterial.visible = true
    inbetweenMaterial.visible = true      
    outlineMaterial.visible = false
  }

  camera = cameras[CAMERA_SWITCH]
  renderer.render(scene, camera)
  if (MANUAL_PLAYBACK == false) {
      AnimData.nextFrame()
  }
}


// Document
document.addEventListener('keydown', onDocumentKeyDown, false)
function onDocumentKeyDown(event) {
  var keyCode = event.key
  if (keyCode == '1') {
    SHOW_FRAMES = (SHOW_FRAMES + 1) % 3
  } else if (keyCode == '2') {
    CAMERA_SWITCH = (CAMERA_SWITCH + 1) % 2
  } else if (MANUAL_PLAYBACK == true && keyCode == 'n') {
    AnimData.nextFrame()
  } else if (MANUAL_PLAYBACK == true && keyCode == 'p') {
    AnimData.prevFrame()
  } else if (keyCode == '.') {
    AnimData.nextSequence()
    animate()
  } else if (keyCode == ',') {
    AnimData.prevSequence()
    animate()
  } else if (keyCode == '3') {
    SHOW_OUTLINE = !SHOW_OUTLINE
  } else if (keyCode == ' ') {
    MANUAL_PLAYBACK = !MANUAL_PLAYBACK
    console.log("Manual is" + MANUAL_PLAYBACK)
  } else if (keyCode == 's') {
    SAVE_KEYFRAME_MODE = !SAVE_KEYFRAME_MODE
  }
}

// renderer
var renderer = new THREE.WebGLRenderer()
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.gammaInput = true
renderer.gammaOutput = true
var effect = new THREE.OutlineEffect(renderer, {
  defaultColor: new THREE.Color(0x000000),
})

// scene
var scene = new THREE.Scene()
scene.background = new THREE.Color(0xf0f0f0)
var ambient = new THREE.AmbientLight(0xffffff, 0.1)
scene.add(ambient)

// lighting
var spotLight = new THREE.SpotLight(0xffffff, 1)
spotLight.position.set(-15, 100, 35)
spotLight.angle = Math.PI / 4
spotLight.penumbra = 0.05
spotLight.decay = 1
spotLight.distance = 200
spotLight.castShadow = true
spotLight.shadow.mapSize.width = 1024
spotLight.shadow.mapSize.height = 1024
spotLight.shadow.camera.near = 10
spotLight.shadow.camera.far = 200
scene.add(spotLight)

// cameras
var perspectiveCamera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  1,
  1000
)
perspectiveCamera.position.set(18, 2, 9)
var w = window.innerWidth
var h = window.innerHeight
var orthoCamera = new THREE.OrthographicCamera(
  w / -2,
  w / 2,
  h / 2,
  h / -2,
  -1000,
  1000
)
orthoCamera.position.set(0, 0, 10)
orthoCamera.zoom = 30
orthoCamera.updateProjectionMatrix()

var cameras = [perspectiveCamera, orthoCamera]
camera = cameras[CAMERA_SWITCH]

// camera control
var perspectiveControls = new THREE.OrbitControls(
  perspectiveCamera,
  renderer.domElement
)
perspectiveControls.minDistance = 20
perspectiveControls.maxDistance = 500
perspectiveControls.enablePan = false
var orthoControls = new THREE.OrbitControls(orthoCamera, renderer.domElement)
orthoControls.minDistance = 20
orthoControls.maxDistance = 500
orthoControls.enablePan = true
orthoControls.target.set(0, 0, 0)
var controls = [perspectiveControls, orthoControls]

// objloader
var progressWrapper = document.createElement('div')
var progressBar = document.createElement('div')
progressWrapper.className = 'loader-progress-wrapper'
progressBar.className = 'loader-progress-progress'
progressBar.style.width = '0%'
progressWrapper.appendChild(progressBar)

var manager = new THREE.LoadingManager()
manager.onStart = function(url, itemsLoaded, itemsTotal) {
  document.body.appendChild(progressWrapper)
}

manager.onError = function(url) {
  console.log('There was an error loading ' + url)
}


var objLoader = new THREE.OBJLoader2(manager)

function loadObjMesh(file) {
  return new Promise((resolve, reject) => {
    objLoader.load(
      file,
      event => {
        resolve(event.detail.loaderRootNode)
      },
      null,
      null,
      null,
      false
    )
  })
}

async function loadObjModels() {
  var model
  var anim = []
  var basepath = 'models/'
  var files = ['base4.obj', 'leg4.obj', 'neck4.obj', 'head4.obj']
  var anim_files = ['pred.json', 'actual.json', 'key_cts.json']

  manager.onProgress = function(url, itemsLoaded, itemsTotal) {
    progressBar.style.width = itemsLoaded / files.length * 100 + '%'
  }

  for (var i = 0; i < files.length; i++) {
    model = await loadObjMesh(basepath + files[i])
  }
  for (var i = 0; i < anim_files.length; i++) {
    anim.push(await $.getJSON(anim_files[i]))
  }

  // remove progress bar and render canvas
  document.body.removeChild(progressWrapper)
  document.body.appendChild(renderer.domElement)

  model.children.map(mesh => {
    mesh.geometry = new THREE.Geometry().fromBufferGeometry(mesh.geometry)
    mesh.geometry.center()
  })
  return [model,anim]
}

loadObjModels().then(objs => {
  var meshes = objs[0]
  var anim_data = objs[1]

  var baseMesh = meshes.children[0]
  var legMesh = meshes.children[1]
  var neckMesh = meshes.children[2]
  var headMesh = meshes.children[3]

  baseMesh.geometry.computeBoundingSphere()
  mscale = 1.0 / baseMesh.geometry.boundingSphere.radius

  baseMesh.geometry.scale(mscale, mscale, mscale)
  legMesh.geometry.scale(mscale, mscale, mscale)
  legMesh.geometry.rotateY(-Math.PI / 2)

  neckMesh.geometry.scale(mscale, mscale, mscale)
  neckMesh.geometry.rotateY(-Math.PI / 2)
  var bb = new THREE.Box3().setFromObject(neckMesh)
  var ss = bb.getSize()
  neckMesh.geometry.translate(0, ss.y / 2.0, 0)

  headMesh.geometry.scale(mscale, mscale, mscale)
  var bb2 = new THREE.Box3().setFromObject(headMesh)
  var ss2 = bb2.getSize()
  headMesh.geometry.rotateY(-Math.PI / 2)
  headMesh.geometry.rotateZ(-Math.PI / 2)
  headMesh.geometry.translate(0, ss.y / 2, 0)

  // Luxo model definition
  LuxoClass = class LuxoModel {
    constructor(material, outlineMaterial, castShadow) {
      var castShadow = castShadow || true

      // cylinder: (radius, radius, height, rsegment, hsegment)
      // Base
      this.base = {}
      this.base.model = baseMesh.clone()
      var box = new THREE.Box3().setFromObject(this.base.model)
      var size = box.getSize()
      this.base.radius = size.x
      this.base.height = size.y
      this.base.angle = 0
      this.base.model.material = material
      this.base.model.castShadow = castShadow
      this.base.outline = new THREE.LineSegments(
        new THREE.WireframeGeometry(this.base.model.geometry),
        outlineMaterial
      )
      this.base.model.add(this.base.outline)

      // Leg
      this.leg = {}
      this.leg.model = legMesh.clone()
      box = new THREE.Box3().setFromObject(this.leg.model)
      size = box.getSize()
      this.leg.radius = size.x
      this.leg.length = size.y
      this.leg.angle = 0
      this.leg.model.material = material
      this.leg.model.castShadow = castShadow
      this.leg.outline = new THREE.LineSegments(
        new THREE.WireframeGeometry(this.leg.model.geometry),
        outlineMaterial
      )
      this.leg.model.add(this.leg.outline)

      // Torso
      this.torso = {}
      this.torso.model = neckMesh.clone()
      box = new THREE.Box3().setFromObject(this.torso.model)
      size = box.getSize()
      this.torso.radius = size.x
      this.torso.length = size.y
      this.torso.angle = 0
      this.torso.model.material = material
      this.torso.model.castShadow = castShadow
      this.torso.outline = new THREE.LineSegments(
        new THREE.WireframeGeometry(this.torso.model.geometry),
        outlineMaterial
      )
      this.torso.model.add(this.torso.outline)

      // Head
      this.head = {}
      this.head.model = headMesh.clone()
      box = new THREE.Box3().setFromObject(this.head.model)
      size = box.getSize()
      this.head.radius = size.x
      this.head.length = size.y
      this.head.angle = Math.PI / 2
      this.head.model.material = material
      this.head.model.castShadow = castShadow
      this.head.outline = new THREE.LineSegments(
        new THREE.WireframeGeometry(this.head.model.geometry),
        outlineMaterial
      )
      this.head.model.add(this.head.outline)

      // Overall model
      this.model = new THREE.Group()
      this.torso.model.add(this.head.model)
      this.leg.model.add(this.torso.model)
      this.base.model.add(this.leg.model)
      this.model.add(this.base.model)

      // Call setState
      this.setState(0, 0, 0, 0, 0, 0)
    }

    setState(x, y, baseAngle, legAngle, torsoAngle, headAngle) {
      //console.log(x,y,baseAngle,legAngle,torsoAngle);
      this.base.angle = baseAngle
      //this.leg.angle = legAngle + this.base.angle
      this.leg.angle = legAngle
      this.torso.angle = torsoAngle
      this.head.angle = Math.PI / 2 + headAngle

      // Compute base object
      this.base.x = x + this.base.radius * Math.cos(this.base.angle)
      this.base.y =
        y + this.base.height / 2 - this.base.radius * Math.sin(this.base.angle)

      // Compute torso object
      this.torso.x =
        this.base.x +
        this.leg.length * Math.cos(Math.PI / 2 - this.leg.angle) +
        this.torso.length / 2 * Math.cos(Math.PI / 2 - this.torso.angle)
      this.torso.y =
        this.base.y +
        this.leg.length * Math.sin(Math.PI / 2 - this.leg.angle) +
        this.torso.length / 2 * Math.sin(Math.PI / 2 - this.torso.angle)

      // Compute head object
      this.head.x =
        this.torso.x +
        this.torso.length / 2 * Math.cos(Math.PI / 2 - this.torso.angle) +
        this.head.length / 2 * Math.cos(Math.PI / 2 - this.head.angle)
      this.head.y =
        this.torso.y +
        this.torso.length / 2 * Math.sin(Math.PI / 2 - this.torso.angle) +
        this.head.length / 2 * Math.sin(Math.PI / 2 - this.head.angle)

      this.updateModel()
    }

    updateModel() {
      this.base.model.position.x = this.base.x
      this.base.model.position.y = this.base.y
      // Rotation is reversed
      this.base.model.rotation.z = -this.base.angle

      // Leg
      this.leg.model.matrix.identity()
      this.leg.model.applyMatrix(
        new THREE.Matrix4().makeTranslation(0, this.leg.length / 2, 0)
      )
      this.leg.model.applyMatrix(
        new THREE.Matrix4().makeRotationZ(-this.leg.angle)
      )

      // Torso
      this.torso.model.matrix.identity()
      var rotation = new THREE.Matrix4().makeRotationZ(-this.torso.angle)
      var t1 = new THREE.Matrix4().makeTranslation(0, this.leg.length / 2, 0)
      var tt = t1.multiply(rotation)
      this.torso.model.applyMatrix(tt)

      // Head
      this.head.model.matrix.identity()
      var rotation = new THREE.Matrix4().makeRotationZ(-this.head.angle)
      var t1 = new THREE.Matrix4().makeTranslation(0, this.torso.length, 0)
      var tt = t1.multiply(rotation)
      this.head.model.applyMatrix(tt)
    }
  }

  // Adding luxo to scene
  outlineMaterial.visible = false

  luxo = new LuxoClass(material, outlineMaterial, false)
  scene.add(luxo.model)
  console.log(luxo)

  // Adding floor to scene
  var floor = new THREE.Mesh(
    new THREE.BoxGeometry(2000, 1, 2000),
    new THREE.MeshToonMaterial({ color: 0x808080, dithering: true })
  )
  floor.position.set(0, -0.5, 0)
  floor.receiveShadow = true
  scene.add(floor)

  // init camera control
  controls.forEach(control => control.update())
    
  AnimData = new AnimDataClass()
  AnimData.set_all_predictions(anim_data[0])
  AnimData.set_keyframes(anim_data[2])

  gui.add(AnimData,"base_x").listen()
  gui.add(AnimData,"base_y").listen()
  gui.add(AnimData,"base_ori").listen()
  gui.add(AnimData,"leg_angle").listen()
  gui.add(AnimData,"neck_angle").listen()
  gui.add(AnimData,"head_angle",-1.7,0.17).listen()

  animate()
})
