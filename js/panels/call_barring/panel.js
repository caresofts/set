/**
 *  Call Barring Settings
 *  Manage the state of the different services of call barring
 */
define('panels/call_barring/call_barring',['require','modules/mvvm/observable'],function(require) {
  'use strict';

  var Observable = require('modules/mvvm/observable');

  var _cbAction = {
    CALL_BARRING_BAOC: 0,     // BAOC: Barring All Outgoing Calls
    CALL_BARRING_BOIC: 1,     // BOIC: Barring Outgoing International Calls
    CALL_BARRING_BOICexHC: 2, // BOICexHC: Barring Outgoing International
                              //           Calls Except  to Home Country
    CALL_BARRING_BAIC: 3,     // BAIC: Barring All Incoming Calls
    CALL_BARRING_BAICr: 4     // BAICr: Barring All Incoming Calls in Roaming
  };

  var _cbServiceMapper = {
    'baoc': _cbAction.CALL_BARRING_BAOC,
    'boic': _cbAction.CALL_BARRING_BOIC,
    'boicExhc': _cbAction.CALL_BARRING_BOICexHC,
    'baic': _cbAction.CALL_BARRING_BAIC,
    'baicR': _cbAction.CALL_BARRING_BAICr
  };

  var call_barring_prototype = {
    // settings
    baoc: '',
    boic: '',
    boicExhc: '',
    baic: '',
    baicR: '',
    // enabled state for the settings
    baoc_enabled: '',
    boic_enabled: '',
    boicExhc_enabled: '',
    baic_enabled: '',
    baicR_enabled: '',

    // updatingState
    updating: false,

    _enable: function(elementArray) {
      elementArray.forEach(function disable(element) {
        this[element + '_enabled'] = true;
      }.bind(this));

      // If barring All Outgoing is set, disable the rest of outgoing calls
      if (!!this.baoc) {
        this.boic_enabled = false;
        this.boicExhc_enabled = false;
      }
      // If barring All Incoming is active, disable the rest of incoming calls
      if (!!this.baic) {
        this.baicR_enabled = false;
      }
    },

    _disable: function(elementArray) {
      elementArray.forEach(function disable(element) {
        this[element + '_enabled'] = false;
      }.bind(this));
    },

    /**
     * Makes a request to the RIL for the current state of a specific
     * call barring option.
     * @param id Code of the service we want to request the state of
     * @returns Promise with result/error of the request
     */
    _getRequest: function(api, id) {
      var callOptions = {
        'program': id,
        'serviceClass': api.ICC_SERVICE_CLASS_VOICE
      };
      return new Promise(function (resolve, reject) {
        // Send the request
        var request = api.getCallBarringOption(callOptions);
        request.onsuccess = function() {
          resolve(request.result.enabled);
        };
        request.onerror = function() {
          /* request.error = { name, message } */
          reject(request.error);
        };
      });
    },

    /**
     * Makes a request to the RIL to change the current state of a specific
     * call barring option.
     * @param options - options object with the details of the new state
     * @param options.program - id of the service to update
     * @param options.enabled - new state for the service
     * @param options.password - password introduced by the user
     * @param options.serviceClass - type of RIL service (voice in this case)
     */
    _setRequest: function(api, options) {
      return new Promise(function (resolve, reject) {
        // Send the request
        var request = api.setCallBarringOption(options);
        request.onsuccess = function() {
          resolve();
        };
        request.onerror = function() {
          /* request.error = { name, message } */
          reject(request.error);
        };
      });
    },

    set: function(api, setting, password) {
      // Check for updating in progress
      if (!!this.updating) {
        return;
      }
      // Check for API to be called
      if (!api) {
        return;
      }

      var self = this;
      return new Promise(function (resolve, reject) {
        self.updating = true;
        var allElements = [
          'baoc',
          'boic',
          'boicExhc',
          'baic',
          'baicR'
        ];
        self._disable(allElements);
        // get options
        var options = {
          'program': _cbServiceMapper[setting],
          'enabled': !self[setting],
          'password': password,
          'serviceClass': api.ICC_SERVICE_CLASS_VOICE
        };

        var error = null;
        self._setRequest(api, options).then(function success() {
          self[setting] = !self[setting];
        }).catch(function errored(err) {
          error = err;
        }).then(function doAnyways() {
          self.updating = false;
          self._enable(allElements);
          if (!error) {
            resolve();
          } else {
            reject(error);
          }
        });
      });
    },

    getAll: function(api) {
      // Check for updating in progress
      if (!!this.updating) {
        return;
      }
      // Check for API to be called
      if (!api) {
        return;
      }

      // Check for all elements' status
      var allElements = [
        'baoc',
        'boic',
        'boicExhc',
        'baic',
        'baicR'
      ];

      var self = this;
      self.updating = true;

      return new Promise(function (resolve, reject) {
        self._disable(allElements);

        var setting = 'baoc';
        self._getRequest(api, _cbServiceMapper[setting]).then(
          function received(value) {
          self[setting] = value;
          setting = 'boic';
          return self._getRequest(api, _cbServiceMapper[setting]);
        }).then(function received(value) {
          self[setting] = value;
          setting = 'boicExhc';
          return self._getRequest(api, _cbServiceMapper[setting]);
        }).then(function received(value) {
          self[setting] = value;
          setting = 'baic';
          return self._getRequest(api, _cbServiceMapper[setting]);
        }).then(function received(value) {
          self[setting] = value;
          setting = 'baicR';
          return self._getRequest(api, _cbServiceMapper[setting]);
        }).then(function received(value) {
          self[setting] = value;
        }).catch(function errorWhileProcessing(err) {
          console.error('Error receiving Call Barring status: ' +
            err.name + ' - ' + err.message);
        }).then(function afterEverythingDone() {
          self.updating = false;
          self._enable(allElements);
          resolve();
        });
      });
    }
  };

  var callBarring = Observable(call_barring_prototype);
  return callBarring;
});

/* exported InputPasscodeScreen */

define('panels/call_barring/passcode_dialog',['require'],function(require) {
  'use strict';

  var InputPasscodeScreen = function() {
    const PIN_SIZE = 4;

    var panel,
        container,
        input,
        btnOK,
        btnCancel;
    var _passcodeDigits,
        _passcodeBuffer;

    function _getInputKey(evt) {
      var code = evt.charCode;
      if (code !== 0 && (code < 0x30 || code > 0x39)) {
        return;
      }

      var key = String.fromCharCode(code);

      if (evt.charCode === 0) { // Deletion
        if (_passcodeBuffer.length > 0) {
          _passcodeBuffer = _passcodeBuffer.substring(0,
            _passcodeBuffer.length - 1);
        }
      } else if (_passcodeBuffer.length < PIN_SIZE) {
        _passcodeBuffer += key;
      }

      _updateUI();
    }

    function _updateUI() {
      for (var i = 0; i < PIN_SIZE; i++) {
        if (i < _passcodeBuffer.length) {
          _passcodeDigits[i].dataset.dot = true;
        } else {
          delete _passcodeDigits[i].dataset.dot;
        }
      }

      btnOK.disabled = _passcodeBuffer.length === PIN_SIZE ? false : true;
    }

    function _init() {
      panel = document.getElementById('cb-passcode');
      container = panel.querySelector('.passcode-container');
      input = panel.querySelector('.passcode-input');
      _passcodeDigits = panel.querySelectorAll('.passcode-digit');
      _passcodeBuffer = '';

      btnOK = document.getElementById('cb-passcode-ok-btn');
      btnCancel = document.getElementById('cb-passcode-cancel-btn');

      container.addEventListener('click', function(evt) {
        input.focus();
        evt.preventDefault();
      });

      input.addEventListener('keypress', _getInputKey);
    }

    function okClicked() {
      if (_passcodeBuffer.length === 4) {
        var password = _passcodeBuffer;
        _closePanel();
        /*jshint validthis: true */
        this.resolve(password);
      }
    }

    function cancelClicked() {
      _closePanel();
      /*jshint validthis: true */
      this.reject();
    }

    function _showPanel() {
      return new Promise((resolve, reject) => {
        panel.hidden = false;
        input.focus();
        this.resolve = resolve;
        this.reject = reject;

        btnOK.addEventListener('click', okClicked.bind(this));
        btnCancel.addEventListener('click', cancelClicked.bind(this));
      });
    }

    function _closePanel() {
      btnOK.removeEventListener('click', okClicked);
      btnCancel.removeEventListener('click', cancelClicked);
      _passcodeBuffer = '';
      _updateUI();
      panel.hidden = true;
    }

    return {
      init: _init,
      show: _showPanel
    };
  };

  return InputPasscodeScreen;
});

/* global DsdsSettings */

define('panels/call_barring/panel',['require','modules/settings_panel','panels/call_barring/call_barring','panels/call_barring/passcode_dialog','shared/toaster'],function(require) {
  'use strict';

  var SettingsPanel = require('modules/settings_panel');
  var CallBarring = require('panels/call_barring/call_barring');
  var InputPasscodeScreen = require('panels/call_barring/passcode_dialog');
  var Toaster = require('shared/toaster');

  return function ctor_call_barring() {
    var _callBarring = CallBarring;
    var _passcodeScreen = InputPasscodeScreen();

    var _mobileConnection;
    var _cbSettings = {};

    var _refresh;
    var _updating;

    /**
     * To avoid modifying the setting for the wrong SIM card, it's better to
     * update the current mobile connection before using it.
     * see: https://bugzilla.mozilla.org/show_bug.cgi?id=910552#c81
     */
    function _updateMobileConnection() {
      _mobileConnection = window.navigator.mozMobileConnections[
        DsdsSettings.getIccCardIndexForCallSettings()
      ];
    }

    /**
     *  Manage when to update the data
     */
    function refresh_on_load(e) {
      // Refresh when:
      //  - we load the panel from #call
      //  - we re-load the panel after hide (screen off or change app)
      // But NOT when:
      //  - we come back from changing the password
      if (e.detail.current === '#call-cbSettings' &&
          e.detail.previous === '#call-barring-passcode-change') {
            _refresh = false;
      }
    }

    /**
     * Updates a Call Barring item with a new status.
     * @parameter item DOM 'li' element to update
     * @parameter newStatus Object with data for the update. Of the form:
     * {
     *   disabled:[true|false], // optional, new disabled state
     *   checked: [true|false], // optional, new checked state for the input
     *   message: [string]      // optional, new message for the description
     * }
     */
    function _updateCallBarringItem(item, newStatus) {
      var descText = item.querySelector('details');
      var input = item.querySelector('gaia-switch');

      // disable the item
      if (typeof newStatus.disabled === 'boolean') {
        newStatus.disabled ?
          item.setAttribute('aria-disabled', true) :
          item.removeAttribute('aria-disabled');

        if (input) {
          input.disabled = newStatus.disabled;
        }
      }

      // update the input value
      if (input && typeof newStatus.checked === 'boolean') {
        input.checked = newStatus.checked;
      }

      // update the description
      function inputValue() {
        return input && input.checked ? 'enabled' : 'disabled';
      }
      if (descText) {
        var text = _updating ? 'callSettingsQuery' : inputValue();
        navigator.mozL10n.setAttributes(descText, text);
      }
    }

    /**
     * Shows the passcode input screen for the user to introduce the PIN
     * needed to activate/deactivate a service
     */
    function _callBarringClick(evt) {
      var input = evt.target;

      // do not change the UI, let it be managed by the data model
      evt.preventDefault();
      // Show passcode screen
      _passcodeScreen.show().then(function confirmed(passcode) {
        // passcode screen confirmed
        var inputID = input.parentNode.id;

        var setting = inputID.substring(6);
        _updateMobileConnection();
        _callBarring.set(_mobileConnection, setting, passcode).catch(
          function error(err) {
          // err = { name, message }
          var toast;
          if (err.name === 'GenericFailure') {
            // show more user friendly string
            toast = {
              messageL10nId: 'callBarring-update-generic-error',
              latency: 2000,
              useTransition: true
            };
          } else {
            toast = {
              messageL10nId: 'callBarring-update-item-error',
              messageL10nArgs: {'error': err.name || 'unknown'},
              latency: 2000,
              useTransition: true
            };
          }
          Toaster.showToast(toast);
        });
      }).catch(function canceled() {
        // passcode screen canceled, nothing to do yet
      });
    }

    return SettingsPanel({
      onInit: function cb_onInit(panel) {
        _cbSettings = {
          baoc: document.getElementById('li-cb-baoc'),
          boic: document.getElementById('li-cb-boic'),
          boicExhc: document.getElementById('li-cb-boicExhc'),
          baic: document.getElementById('li-cb-baic'),
          baicR: document.getElementById('li-cb-baicR')
        };

        for (var i in _cbSettings) {
          _cbSettings[i].querySelector('gaia-switch').
            addEventListener('click', _callBarringClick);
        }

        _updateMobileConnection();
        _passcodeScreen.init();
      },

      onBeforeShow: function cb_onBeforeShow() {
        _refresh = true;
        _updating = false;

        for (var element in _cbSettings) {
          _callBarring[element] = false;
          _updateCallBarringItem(_cbSettings[element], {'checked': false});
        }

        window.addEventListener('panelready', refresh_on_load);

        // Changes on settings value
        _callBarring.observe('baoc', function(newValue) {
          _updateCallBarringItem(_cbSettings.baoc, {'checked': newValue});
        });
        _callBarring.observe('boic', function(newValue) {
          _updateCallBarringItem(_cbSettings.boic, {'checked': newValue});
        });
        _callBarring.observe('boicExhc', function(newValue) {
          _updateCallBarringItem(_cbSettings.boicExhc, {'checked': newValue});
        });
        _callBarring.observe('baic', function(newValue) {
          _updateCallBarringItem(_cbSettings.baic, {'checked': newValue});
        });
        _callBarring.observe('baicR', function(newValue) {
          _updateCallBarringItem(_cbSettings.baicR, {'checked': newValue});
        });

        // Changes on settings availability
        _callBarring.observe('baoc_enabled', function changed(newValue) {
          _updateCallBarringItem(_cbSettings.baoc, {'disabled': !newValue});
        });
        _callBarring.observe('boic_enabled', function changed(newValue) {
          _updateCallBarringItem(_cbSettings.boic, {'disabled': !newValue});
        });
        _callBarring.observe('boicExhc_enabled', function changed(newValue) {
          _updateCallBarringItem(_cbSettings.boicExhc, {'disabled': !newValue});
        });
        _callBarring.observe('baic_enabled', function changed(newValue) {
          _updateCallBarringItem(_cbSettings.baic, {'disabled': !newValue});
        });
        _callBarring.observe('baicR_enabled', function changed(newValue) {
          _updateCallBarringItem(_cbSettings.baicR, {'disabled': !newValue});
        });

        _callBarring.observe('updating', function changed(newValue) {
          _updating = newValue;
        });
      },

      onShow: function cb_onShow() {
        if (_refresh) {
          _updateMobileConnection();
          _callBarring.getAll(_mobileConnection);
        }
      },

      onBeforeHide: function cb_onHide() {
        window.removeEventListener('panelready', refresh_on_load);

        _callBarring.unobserve('baoc');
        _callBarring.unobserve('boic');
        _callBarring.unobserve('boicExhc');
        _callBarring.unobserve('baic');
        _callBarring.unobserve('baicR');

        _callBarring.unobserve('baoc_enabled');
        _callBarring.unobserve('boic_enabled');
        _callBarring.unobserve('boicExhc_enabled');
        _callBarring.unobserve('baic_enabled');
        _callBarring.unobserve('baicR_enabled');

        _callBarring.unobserve('updating');
      }
    });
  };
});

