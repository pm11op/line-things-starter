// User service UUID: Change this to your generated service UUID
const USER_SERVICE_UUID         = 'd4085648-ec7e-471a-a612-cb98fe8f33a7'; // LED, Button
// User service characteristics
const LED_CHARACTERISTIC_UUID   = 'E9062E71-9E62-4BC6-B0D3-35CDCD9B027B';
const BTN_CHARACTERISTIC_UUID   = '62FBD229-6EDD-4D1A-B554-5C4E1BB29169';

// PSDI Service UUID: Fixed value for Developer Trial
const PSDI_SERVICE_UUID         = 'E625601E-9E55-4597-A598-76018A0D293D'; // Device ID
const PSDI_CHARACTERISTIC_UUID  = '26E2B12B-85F0-4F3F-9FDD-91D114270E6E';

// UI settings
let ledState = false; // true: LED on, false: LED off
let clickCount = 0;

// pm11op
let _device = {}

// -------------- //
// On window load //
// -------------- //
window.onload = () => {
    initializeApp();
};

// ----------------- //
// Handler functions //
// ----------------- //

function handlerToggleLed() {
    ledState = !ledState;

    uiToggleLedButton(ledState);
    liffToggleDeviceLedState(ledState);
}

// ------------ //
// UI functions //
// ------------ //

function uiToggleLedButton(state) {
    const el = document.getElementById("btn-led-toggle");
    el.innerText = state ? "Switch LED OFF" : "Switch LED ON";

    if (state) {
      el.classList.add("led-on");
    } else {
      el.classList.remove("led-on");
    }
}

function uiCountPressButton() {
    clickCount++;

    const el = document.getElementById("click-count");
  el.innerText = clickCount;

  return fetch('https://masarun.co/api/line/test', {method: 'POST', body: JSON.stringify(  {'click': clickCount, 'device': _device.id, 'uuid': USER_SERVICE_UUID})})
}

function uiToggleStateButton(pressed) {
    const el = document.getElementById("btn-state");

    if (pressed) {
        el.classList.add("pressed");
        el.innerText = "Pressed";
    } else {
        el.classList.remove("pressed");
        el.innerText = "Released";
    }
}

function uiToggleDeviceConnected(connected) {
    const elStatus = document.getElementById("status");
    const elControls = document.getElementById("controls");

    elStatus.classList.remove("error");

    if (connected) {
        // Hide loading animation
        uiToggleLoadingAnimation(false);
        // Show status connected
        elStatus.classList.remove("inactive");
        elStatus.classList.add("success");
        elStatus.innerText = "Device connected";
        // Show controls
        elControls.classList.remove("hidden");
    } else {
        // Show loading animation
        uiToggleLoadingAnimation(true);
        // Show status disconnected
        elStatus.classList.remove("success");
        elStatus.classList.add("inactive");
        elStatus.innerText = "Device disconnected";
        // Hide controls
        elControls.classList.add("unhidden");
    }
}

function uiToggleLoadingAnimation(isLoading) {
    const elLoading = document.getElementById("loading-animation");

    if (isLoading) {
        // Show loading animation
        elLoading.classList.remove("hidden");
    } else {
        // Hide loading animation
        elLoading.classList.add("hidden");
    }
}

function uiStatusError(message, showLoadingAnimation) {
    uiToggleLoadingAnimation(showLoadingAnimation);

    const elStatus = document.getElementById("status");
    const elControls = document.getElementById("controls");

    // Show status error
    elStatus.classList.remove("success");
    elStatus.classList.remove("inactive");
    elStatus.classList.add("error");
    elStatus.innerText = message;

    // Hide controls
    elControls.classList.add("unhidden");
}

function makeErrorMsg(errorObj) {
    return "Error\n" + errorObj.code + "\n" + errorObj.message;
}

// -------------- //
// LIFF functions //
// -------------- //

function initializeApp() {
    liff.init(() => initializeLiff(), error => uiStatusError(makeErrorMsg(error), false));
}

function initializeLiff() {
    liff.initPlugins(['bluetooth']).then(() => {
        liffCheckAvailablityAndDo(() => liffRequestDevice());
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffCheckAvailablityAndDo(callbackIfAvailable) {
    // Check Bluetooth availability
    liff.bluetooth.getAvailability().then(isAvailable => {
        if (isAvailable) {
            uiToggleDeviceConnected(false);
            callbackIfAvailable();
        } else {
            uiStatusError("Bluetooth not available", true);
            setTimeout(() => liffCheckAvailablityAndDo(callbackIfAvailable), 10000);
        }
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });;
}

function liffRequestDevice() {
    liff.bluetooth.requestDevice().then(device => {
        liffConnectToDevice(device);
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffConnectToDevice(device) {
    _device = device
    device.gatt.connect().then(() => {
        document.getElementById("device-name").innerText = device.name;
        document.getElementById("device-id").innerText = device.id;

        // Show status connected
        uiToggleDeviceConnected(true);

        // Get service
        device.gatt.getPrimaryService(USER_SERVICE_UUID).then(service => {
            liffGetUserService(service);
        }).catch(error => {
            uiStatusError(makeErrorMsg(error), false);
        });
        device.gatt.getPrimaryService(PSDI_SERVICE_UUID).then(service => {
            liffGetPSDIService(service);
        }).catch(error => {
            uiStatusError(makeErrorMsg(error), false);
        });

        // Device disconnect callback
        const disconnectCallback = () => {
            // Show status disconnected
            uiToggleDeviceConnected(false);

            // Remove disconnect callback
            device.removeEventListener('gattserverdisconnected', disconnectCallback);

            // Reset LED state
            ledState = false;
            // Reset UI elements
            uiToggleLedButton(false);
            uiToggleStateButton(false);

            // Try to reconnect
            initializeLiff();
        };

        device.addEventListener('gattserverdisconnected', disconnectCallback);
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffGetUserService(service) {
    // Button pressed state
  service.getCharacteristic(BTN_CHARACTERISTIC_UUID).then(characteristic => {
//              liffGetButtonStateCharacteristic(characteristic);
        liffGetDeviceCharacteristic(characteristic);      
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });

    // Toggle LED
    service.getCharacteristic(LED_CHARACTERISTIC_UUID).then(characteristic => {
        window.ledCharacteristic = characteristic;

        // Switch off by default
        liffToggleDeviceLedState(false);
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffGetPSDIService(service) {
    // Get PSDI value
    service.getCharacteristic(PSDI_CHARACTERISTIC_UUID).then(characteristic => {
        return characteristic.readValue();
    }).then(value => {
        // Byte array to hex string
        const psdi = new Uint8Array(value.buffer)
            .reduce((output, byte) => output + ("0" + byte.toString(16)).slice(-2), "");
        document.getElementById("device-psdi").innerText = psdi;
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffGetButtonStateCharacteristic(characteristic) {
    // Add notification hook for button state
    // (Get notified when button state changes)
    characteristic.startNotifications().then(() => {
        characteristic.addEventListener('characteristicvaluechanged', e => {
          const val = (new Uint8Array(e.target.value.buffer))[0];
            if (val > 0) {
                // press
                uiToggleStateButton(true);
            } else {
                // release
                uiToggleStateButton(false);
                uiCountPressButton();
            }
        });
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}

function liffToggleDeviceLedState(state) {
    // on: 0x01
    // off: 0x00
    window.ledCharacteristic.writeValue(
        state ? new Uint8Array([0x01]) : new Uint8Array([0x00])
    ).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });
}


function liffGetDeviceCharacteristic(characteristic) {
    characteristic.startNotifications().then(() => {
        characteristic.addEventListener('characteristicvaluechanged', e => {
            const val = (new Uint8Array(e.target.value.buffer))[0];
            if (val > 0) {
                uiCountPressButton();
                uiCountWeight(val);
            } else {
                uiCountWeight(0);
            }
        });
    }).catch(error => {
        uiStatusError(makeErrorMsg(error), false);
    });

}

function uiCountWeight(val) {
  const el = document.getElementById("scale_weight");
  if (el) {
//    el.innerText = val;
    startAnim(val, el)
    fixVal(val)
    return
    if (!el.classList.contains('hidden')) {
    }
  }
}

/*
  直近 n 回の計測の標準偏差が M 未満であれば確定アニメーション入れて l秒固定
  標準偏差が P 以上であれば配列リセット
*/
const CleanUpScale = {
  n : 5,
  values: [],
  threshold: {
    fix: 1,
    reset: 10,
  },
  avg: 0,
  isAnimating: false,
  isReset: false,
  duration: 0.5,
}

function startAnim(val, el) {
  // reset 時、from は fixedvalue を使用する
  var fromval
  if (CleanUpScale.isReset) {
    fromval = CleanUpScale.fixedValue
    CleanUpScale.fixedValue = 0
    CleanUpScale.isReset = false
  } else {
    fromval = CleanUpScale.values[CleanUpScale.values.length-1] || 0
  }
  putValue(val)
  
  // fix したら、次の reset までは維持する
  if (CleanUpScale.isAnimating || CleanUpScale.fixedValue > 0) {
    return
  }
  
  CleanUpScale.isAnimating = true

  let obj = {count: fromval}
  
  TweenMax.to(obj, CleanUpScale.duration, {
    count: val,
    ease: Power3.easeInOut,
    onUpdate: () => {
      el.textContent = Math.floor(obj.count)
    },
    onComplete: () => {
      CleanUpScale.isAnimating = false
      if (CleanUpScale.fixedValue > 0) {
        el.textContent = CleanUpScale.fixedValue
        el.classList.add("fixed")
        setTimeout(()=>{
          el.classList.remove("fixed")
        }, 1000)
      }
    }
  })
}

function average(p,c,i,a){return p + (c/a.length)}
function rootMean(p,c,i,a){
  return p + (Math.pow(c-CleanUpScale.avg, 2)/a.length)
}

function fixVal(val) {
  var avg = CleanUpScale.values.reduce(average, 0)
  CleanUpScale.avg = avg
  var std = Math.sqrt(CleanUpScale.values.reduce(rootMean, 0))
//  console.log(CleanUpScale, avg, std)
  if (CleanUpScale.values.length > CleanUpScale.n / 2  &&
      std <= CleanUpScale.threshold.fix) {
//    console.log('fixed!!')
    CleanUpScale.fixedValue = val
  } else if (std > CleanUpScale.threshold.reset) {
    CleanUpScale.values = [val]
    CleanUpScale.isReset = true
//    console.log('reseted!!')
  }
}

function putValue(val) {
  while (CleanUpScale.values.length >= CleanUpScale.n) {
    CleanUpScale.values.shift()
  }
  CleanUpScale.values.push(val)
}
