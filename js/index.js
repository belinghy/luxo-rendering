// Some global settings
// 0= No frames, 1= Keyframes only, 2= All frames
var SHOW_FRAMES = 0
// 0= Perspective, 1= Orthographic
var CAMERA_SWITCH = 1
var MANUAL = false
var SHOW_OUTLINE = false
var current_frame_index = 0

// Document
document.addEventListener('keydown', onDocumentKeyDown, false)
function onDocumentKeyDown(event) {
  var keyCode = event.key
  if (keyCode == '1') {
    SHOW_FRAMES = (SHOW_FRAMES + 1) % 3
  } else if (keyCode == '2') {
    CAMERA_SWITCH = (CAMERA_SWITCH + 1) % 2
  } else if (MANUAL == true && keyCode == 'n') {
    current_frame_index += 1
  } else if (keyCode == '3') {
    SHOW_OUTLINE = !SHOW_OUTLINE
  } else if (keyCode == ' ') {
    MANUAL = !MANUAL
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
  var anim_files = ['../pred.json', '../actual.json', '../key_cts.json']

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
  console.log(anim)
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
  class LuxoModel {
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
      this.setState(0, 0, 0, 0, 0)
    }

    setState(x, y, baseAngle, legAngle, torsoAngle) {
      //console.log(x,y,baseAngle,legAngle,torsoAngle);
      this.base.angle = baseAngle
      //this.leg.angle = legAngle + this.base.angle
      this.leg.angle = legAngle
      this.torso.angle = torsoAngle
      this.head.angle = Math.PI / 2

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
  outlineMaterial.visible = false

  var luxo = new LuxoModel(material, outlineMaterial, false)
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

  // Keyframes
  var all_keyframes = anim_data[2]
  console.log(all_keyframes)

  // Put keyframes into absolute indexing
  all_keyframes = all_keyframes.map(keyframes => {
    // keyframes is a list of "gaps"
    let acc = 0
    keyframes = keyframes.map(cur => {
      acc = acc + cur + 1
      return acc
    })
    keyframes.unshift(0) // Prepend 0 for first keyframe
    return keyframes
  })

  var predictions = anim_data[0]
  var current_sequence = 0
  var num_sequences = predictions.length
  var animation_frames = predictions[current_sequence]
  var cur_keyframes = all_keyframes[current_sequence]
  var animation_length = animation_frames.length
  var keyframe_index = 0
  var persistentFrame_models = []

  var animate = function() {
    requestAnimationFrame(animate)

    if (current_frame_index == animation_length) {
      // Pick a random sequence
      current_sequence = Math.floor(Math.random() * (num_sequences - 1))
      // In case if length changes
      animation_frames = predictions[current_sequence]
      cur_keyframes = all_keyframes[current_sequence]
      animation_length = animation_frames.length
      current_frame_index = 0
      keyframe_index = 0
      // Clean up keyframes from last sequence
      while (persistentFrame_models.length > 0) {
        var frame = persistentFrame_models.pop()
        scene.remove(frame.model)
      }
    }

    // Spread syntax just turns array into comma separate list
    luxo_states = animation_frames[current_frame_index]
    luxo.setState(...luxo_states)

    // Draw persistent keyframes
    var luxo_arguments = null
    if (current_frame_index == cur_keyframes[keyframe_index]) {
      luxo_arguments = [
        keyframeMaterial,
        outlineMaterial,
        false, //castShadow,
      ]
      keyframe_index += 1
    } else {
      luxo_arguments = [
        inbetweenMaterial,
        outlineMaterial,
        false, //castShadow,
      ]
    }
    // Javascript apparently doesn't have named arguments
    // One way to is make constructor to take an object
    var persistentFrame = new LuxoModel(...luxo_arguments)
    persistentFrame.setState(...animation_frames[current_frame_index])

    if (
      // Show all
      SHOW_FRAMES == 2 ||
      // Show keyframes
      (SHOW_FRAMES == 1 &&
        current_frame_index == cur_keyframes[keyframe_index - 1])
    ) {
      scene.add(persistentFrame.model)
      // Add to list, so we can clean later
      persistentFrame_models.push(persistentFrame)
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
    if (MANUAL == false) {
      current_frame_index += 1
    }
  }
  animate()
})
