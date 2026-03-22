let progress = ''

//変数の定義
class SceneClass {
	constructor(idArray) {
		this.idObject = {}
		for (let id of idArray) {
			this.idObject[id] = document.getElementById(id)
			this.startTime = 0
			this.loadingScene = document.getElementById('loading')
		}
	}

	Show(idName) {
		for (let id in this.idObject) {
			if (id == idName) {
				this.idObject[id].style.display = ''
			} else {
				this.idObject[id].style.display = 'none'
			}
		}
	}

	DisplayLoading(transitionTime, initFlag = true) {
		if (transitionTime <= 0 || this.loadingScene.style.opacity == 1) {
			this.loadingScene.style.display = ''
			return 0
		}

		if (initFlag) {
			this.startTime = Date.now()
			this.loadingScene.style.opacity = 0
			this.loadingScene.style.display = ''
		} else {
			this.loadingScene.style.opacity = (Date.now() - this.startTime) / transitionTime
		}

		if (this.loadingScene.style.opacity >= 1) {
			this.loadingScene.style.opacity = 1
		} else {
			setTimeout(this.DisplayLoading.bind(this), 10, transitionTime, false)
		}
	}

	DestroyLoading(transitionTime, initFlag = true || this.loadingScene.style.opacity == 0) {
		if (transitionTime <= 0) {
			this.loadingScene.style.display = 'none'
			return false
		}

		if (initFlag) {
			this.startTime = Date.now()
			this.loadingScene.style.opacity = 1
		} else {
			this.loadingScene.style.opacity = 1 - (Date.now() - this.startTime) / transitionTime
		}

		if (this.loadingScene.style.opacity <= 0) {
			this.loadingScene.style.opacity = 0
			this.loadingScene.style.display = 'none'
		} else {
			setTimeout(this.DestroyLoading.bind(this), 10, transitionTime, false);
		}
	}
}

const Scene = new SceneClass(['title', 'unsupported', 'controller'])

class MotionButtonClass {
	constructor(motionTypeArray) {
		this.displayType = ''

		this.motionTypeButtonObject = {}
		this.motionPlayButtonObject = {}

		for (let type of motionTypeArray) {
			this.motionTypeButtonObject[type] = document.getElementById('controller_top__select_' + type)
			this.motionTypeButtonObject[type].addEventListener("click", () => {
				this.Show(type)
			}, false);

			this.motionPlayButtonObject[type] = document.getElementsByClassName(type + '_button')
			for (let element of this.motionPlayButtonObject[type]) {
				element.addEventListener("click", () => {
					PlayMotion(event.target.id)
				}, false);
			}
		}
	}

	Show(className) {
		this.displayType = className
		for (let name in this.motionPlayButtonObject) {
			if (name == className) {
				for (let element of this.motionPlayButtonObject[name]) {
					element.style.display = ''
				}
			} else {
				for (let element of this.motionPlayButtonObject[name]) {
					element.style.display = 'none'
				}
			}
		}
	}
}

const MotionButton = new MotionButtonClass(['normal', 'box', 'soccer', 'dance'])

class BleClass {
	constructor() {
		this.ble = new BlueJelly()

		// ESP32 UART (NUS) UUIDs
		this.ble.setUUID("TXdata",
			"6e400001-b5a3-f393-e0a9-e50e24dcca9e",
			"6e400002-b5a3-f393-e0a9-e50e24dcca9e"
		)

		this.CharacteristicIdName = ''
		this.lastWriteUUID = "TXdata"
		this.lastWriteString = ""
	}

	Scan(id) {
		progress = 'Scan'
		DisplayStatus('Paring')
		this.CharacteristicIdName = id
		this.ble.scan(this.CharacteristicIdName)
	}

	Write(uuid, string) {
		this.lastWriteUUID = uuid
		this.lastWriteString = string

		// Convert ASCII → byte array
		const bytes = string.split('').map(c => c.charCodeAt(0))

		this.ble.write(uuid, bytes)
	}

	ReWrite() {
		this.Write(this.lastWriteUUID, this.lastWriteString)
	}
}

const Ble = new BleClass()

Ble.ble.onScan = function (deviceName) {
	progress = 'onScan'
	DisplayStatus('Certifying')
	Ble.ble.connectGATT(Ble.CharacteristicIdName)
}

Ble.ble.onConnectGATT = function (uuid) {
	progress = 'onConnectGATT'
	DisplayStatus('Complete!')
	OnConnected()
}

Ble.ble.onDisconnect = function (deviceName) {
	progress = 'onDisconnect'
	OnDisconnected()
}

//エラー時
Ble.ble.onError = function (error) {
	if (error.toString().search(/Web Bluetooth is not supported/) != -1 ||
		error.toString().search(/Bluetooth Low Energy not available/) != -1) {

		Scene.Show('unsupported')
		Scene.DestroyLoading(500)

	} else {
		if (progress == 'Scan') {
			ShowTitle()
		} else if (progress == 'onScan') {
			Ble.ble.connectGATT(Ble.CharacteristicIdName)
		} else if (progress == 'onConnectGATT') {
			Ble.ReWrite()
		} else if (progress == 'onDisconnect') {
			OnDisconnected()
		} else {
			ShowTitle()
		}
	}
}

class StickClass {

	constructor(id) {
		this.dragging = false

		this.touchStartPoint = { x: 0, y: 0 }
		this.touchPoint = { x: 0, y: 0 }

		this.walkMotionInterval = 500
		this.walkMotion = {
			normal: { forward: 0x46, left: 0x47, right: 0x48, back: 0x49 },
			box: { forward: 0x4A, left: 0x4B, right: 0x4C, back: 0x4D }
		}
		this.walkMotionTimer
		this.sendFlag = false
		this.playWalkMotion = -1
		this.lastWalkMotion = -1

		this.dragElemet = document.getElementById(id)

		// Touch
		this.dragElemet.ontouchstart = (e) => {
			this.touchPoint.x = e.changedTouches[0].pageX
			this.touchPoint.y = e.changedTouches[0].pageY
			this.DragStart()
		}
		document.ontouchmove = (e) => {
			this.touchPoint.x = e.changedTouches[0].pageX
			this.touchPoint.y = e.changedTouches[0].pageY
			this.Move()
		}
		document.ontouchend = (e) => {
			this.touchPoint.x = e.changedTouches[0].pageX
			this.touchPoint.y = e.changedTouches[0].pageY
			this.DragEnd()
		}

		// Mouse
		this.dragElemet.onmousedown = (e) => {
			this.touchPoint.x = e.clientX
			this.touchPoint.y = e.clientY
			this.DragStart()
		}
		document.onmousemove = (e) => {
			this.touchPoint.x = e.clientX
			this.touchPoint.y = e.clientY
			this.Move()
		}
		document.onmouseup = (e) => {
			this.touchPoint.x = e.clientX
			this.touchPoint.y = e.clientY
			this.DragEnd()
		}
	}

	DragStart() {
		if (this.dragging) return 0
		Object.assign(this.touchStartPoint, this.touchPoint)
		this.dragging = true
	}

	Move() {
		if (!this.dragging) return 0
		if (!this.sendFlag) this.PlayWalkMotion()
		let parentWidth = this.dragElemet.parentElement.clientWidth
		let parentHeight = this.dragElemet.parentElement.clientHeight

		let deltaX = (this.touchPoint.x - this.touchStartPoint.x) / parentWidth
		let deltaY = (this.touchPoint.y - this.touchStartPoint.y) / parentHeight

		this.dragElemet.style.left = (50 + Math.sign(deltaX) * 150 * Math.log10((Math.abs(deltaX) + 1))) + '%'
		this.dragElemet.style.top = (50 + Math.sign(deltaY) * 150 * Math.log10((Math.abs(deltaY) + 1))) + '%'

		let direction = Math.atan2(-deltaY, deltaX) / Math.PI * 180

		let walkMotion = {}

		if (MotionButton.displayType == 'box') {
			walkMotion = Object.assign(this.walkMotion.box)
		} else {
			walkMotion = Object.assign(this.walkMotion.normal)
		}

		if (direction >= 45 && direction <= 135) {
			this.playWalkMotion = walkMotion.forward
		} else if (direction >= -135 && direction <= -45) {
			this.playWalkMotion = walkMotion.back
		} else if (direction >= -45 && direction <= 45) {
			this.playWalkMotion = walkMotion.right
		} else {
			this.playWalkMotion = walkMotion.left
		}
	}

	DragEnd() {
		if (!this.dragging) return 0
		this.StopWalkMotion()
		this.dragging = false
		this.dragElemet.style.left = '50%'
		this.dragElemet.style.top = '50%'
	}

	// 歩行モーション再生
	PlayWalkMotion() {
		this.sendFlag = true
		if (this.playWalkMotion >= 0) {
			if (this.lastWalkMotion != this.playWalkMotion) {
				this.lastWalkMotion = this.playWalkMotion
				PlayMotion(-1)
			} else {
				PlayMotion(this.playWalkMotion)
			}
		}

		this.walkMotionTimer = setTimeout(() => this.PlayWalkMotion(), this.walkMotionInterval)
	}

	// 歩行モーション停止
	StopWalkMotion() {
		this.playWalkMotion = -1
		this.lastWalkMotion = -1
		clearTimeout(this.walkMotionTimer)
		PlayMotion(-1)
		this.sendFlag = false
	}
}

const ControleStick = new StickClass('controller__stick_button')

const StartButton = document.getElementById('title_main__start_button');
const NomalMotionButton = document.getElementById('controller_top__select_normal');
const BoxMotionButton = document.getElementById('controller_top__select_box');
const SoccerMotionButton = document.getElementById('controller_top__select_soccer');
const DanceMotionButton = document.getElementById('controller_top__select_dance');

const LoadingStatusMessage = document.getElementById('loading__image_text')

const userAgent = window.navigator.userAgent.toLowerCase();

// ページが読み込まれたとき
window.onpageshow = function (e) {
	DisplayStatus('')
	MotionButton.Show('normal')

	if (BrowserCheck()) {
		if ('serviceWorker' in navigator) {
			if (navigator.onLine) {
				navigator.serviceWorker.getRegistrations().then(function(registrations) {
					for (let registration of registrations) {
						registration.unregister();
					}
				}).catch(function(err) {
					console.log('ServiceWorkerの削除に失敗しました。', err);
				});
			}

			navigator.serviceWorker.register('sw.js').then(function(registration) {
			}).catch(function(err) {
				console.log('ServiceWorkerの登録に失敗しました。', err);
			});
		}

		ShowTitle()
	} else {
		Scene.Show('unsupported')
		Scene.DestroyLoading(500)
	}
}

// 画像ドラッグ対策
document.ondragstart = function () {
	return false
};

// タイトル画面 ==================================
function ShowTitle() {
	progress = ''
	Scene.Show('title')
	Scene.DestroyLoading(500)
}

//スタートボタン
StartButton.addEventListener('click', function () {
	Scene.DisplayLoading(500)
	Ble.Scan("TXdata")
});

// コントローラー画面 ============================
function OnConnected() {
	Scene.Show('controller')
	Scene.DestroyLoading(500)
}

function OnDisconnected() {
	DisplayStatus('Reconnecting')
	Ble.ble.connectGATT(Ble.CharacteristicIdName)
	Scene.DisplayLoading(500)
}

function PlayMotion(moionId) {
	let writeData = ''

	if (moionId == -1) {
		writeData = 'SM'
	} else {
		// Convert motion ID to 2‑digit hex (PLEN protocol)
		writeData = 'PM' + moionId.toString(16)
	}

	// Send ASCII command
	Ble.Write("TXdata", "$" + writeData)
}

// その他========================================

function DisplayStatus(status) {
	LoadingStatusMessage.innerHTML = status
}

function BrowserCheck() {
	if (userAgent.indexOf("iphone") != -1) {
		Support = false;
		Device = "ios";
	} else if (userAgent.indexOf("ipad") != -1) {
		Support = false;
		Device = "ios";
	} else if (userAgent.indexOf("android") != -1) {
		if (userAgent.indexOf("Android") != -1) {
			Support = true;
			Device = "Android";
		} else {
			Support = true;
			Device = "Android";
		}
	} else {
		Support = true;
		Device = "PC";
	}

	if (Support) {
		if (userAgent.indexOf("msie") != -1 ||
			userAgent.indexOf("trident") != -1) {
			Support = false;
			Browser = "IE";
		} else if (userAgent.indexOf("edge") != -1) {
			Support = false;
			Browser = "Edge";
		} else if (userAgent.indexOf("opr") != -1) {
			if (Device == "PC") {
				Support = false;
			} else {
				Support = true;
			}
			Browser = "Opera";
		} else if (userAgent.indexOf("chrome") != -1) {
			Support = true;
			Browser = "Chrome";
		} else if (userAgent.indexOf("safari") != -1) {
			Support = false;
			Browser = "Safari";
		} else if (userAgent.indexOf("firefox") != -1) {
			Support = false;
			Browser = "FireFox";
		} else if (userAgent.indexOf("opera") != -1) {
			if (Device == "PC") {
				Support = false;
			} else {
				Support = true;
			}
			Browser = "Opera";
		} else if (userAgent.indexOf("samsungbrowser") != -1) {
			Support = true;
			Browser = "SamsungInternetBrowser";
		} else {
			Support = false;
			Browser = "Unknown";
		}
	} else {
		if (userAgent.indexOf("bluefy") != -1) {
			Support = true;
			Browser = "Bluefy";
		}
	}

	return Support
}
