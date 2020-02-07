/**
 * Hotspot is a singleton that you can easily use it to fetch
 * some shared data across different panels
 *
 * @module Hotspot
 */
define('panels/hotspot/hotspot',['require','shared/settings_listener'],function(require) {
  'use strict';

  // modules / helpers
  var SettingsListener = require('shared/settings_listener');

  const RE_ENABLE_WIFI_TETHERING_TIME = 1000;

  var Hotspot = function() {
    this._settings = navigator.mozSettings;
  };

  /**
   * @alias module:hotspot/hotspot
   * @requires module:hotspot/hotspot_settings
   * @returns {Hotspot}
   */
  Hotspot.prototype = {
    /**
     * Wifi hotspot setting
     *
     * @memberOf Hotspot
     * @type {Boolean}
     */
    _hotspotSetting: null,
    /**
     * Usb hotspot setting
     *
     * @memberOf Hotspot
     * @type {Boolean}
     */
    _usbHotspotSetting: null,
    /**
     * Usb storage setting
     *
     * @memberOf Hotspot
     * @type {Boolean}
     */
    _usbStorageSetting: null,
    /**
     * These listeners would be called when hotspot setting is changed
     *
     * @memberOf Hotspot
     * @type {Array}
     */
    _hotspotChangeListeners: [],

    /**
     * These listeners would be called when usb hotspot setting is changed
     *
     * @memberOf Hotspot
     * @type {Array}
     */
    _usbHotspotChangeListeners: [],

    /**
     * These listeners would be called when usb storage setting is changed
     *
     * @memberOf Hotspot
     * @type {Array}
     */
    _usbStorageChangeListeners: [],

    /**
     * These listeners would be called when incompatibles settings are
     * enabled at the same time
     *
     * @memberOf Hotspot
     * @type {Array}
     */
    _incompatibleSettingsListeners: [],

    /**
     * Wifi tethering setting key
     *
     * @access public
     * @memberOf Hotspot
     * @type {String}
     */
    tetheringWifiKey: 'tethering.wifi.enabled',

    /**
     * Usb tethering setting key
     *
     * @access public
     * @memberOf Hotspot
     * @type {String}
     */
    tetheringUsbKey: 'tethering.usb.enabled',

    /**
     * Usb storage setting key
     *
     * @access public
     * @memberOf Hotspot
     * @type {String}
     */
    usbStorageKey: 'ums.enabled',

    /**
     * Init is used to initialize some basic stuffs
     *
     * @memberOf Hotspot
     */
    init: function h_init() {
      this._bindEvents();
    },

    /**
     * We will bind some default listeners here
     *
     * @memberOf Hotspot
     */
    _bindEvents: function() {
      // Wifi tethering enabled
      SettingsListener.observe(this.tetheringWifiKey, false,
        this._hotspotSettingChange.bind(this));

      // USB tethering enabled
      SettingsListener.observe(this.tetheringUsbKey, false,
        this._usbHotspotSettingChange.bind(this));

      // USB storage enabled
      SettingsListener.observe(this.usbStorageKey, false,
        this._usbStorageSettingChange.bind(this));
    },

    /**
     * When wifi hotspot is changed, we will call all registered listeners
     *
     * @memberOf Hotspot
     */
    _hotspotSettingChange: function(enabled) {
      this._hotspotSetting = enabled;
      this._hotspotChangeListeners.forEach(function(listener) {
        listener(enabled);
      });
    },

    /**
     * When usb hotspot is changed, we will call all registered listeners
     *
     * @memberOf Hotspot
     */
    _usbHotspotSettingChange: function(enabled) {
      this._usbHotspotSetting = enabled;
      this._usbHotspotChangeListeners.forEach(function(listener) {
        listener(enabled);
      });
    },

    /**
     * When usb storage is changed, we will call all registered listeners
     *
     * @memberOf Hotspot
     */
    _usbStorageSettingChange: function(enabled) {
      this._usbStorageSetting = enabled;
      this._usbStorageChangeListeners.forEach(function(listener) {
        listener(enabled);
      });
    },

    /**
     * When two incompatible settings are enabled we will call all
     * registered listeners.
     *
     * @param bothConflicts Indicates that usb hotspot has the two
     * possible conflicts (wifi hotspot and usb storage)
     *
     * @memberOf Hotspot
     */
    _incompatibleSettings: function(newSetting, oldSetting, bothConflicts) {
      this._incompatibleSettingsListeners.forEach(function(listener) {
        listener(newSetting, oldSetting, bothConflicts);
      });
    },

    /**
     * Check if two incompatible settings are enabled
     *
     * @memberOf Hotspot
     */
    checkIncompatibleSettings: function(newSetting, value) {
      switch(newSetting) {
        case this.tetheringWifiKey:
          // Early return if the user has disabled the setting
          if (!value) {
            this._setWifiTetheringSetting(value);
            return;
          }

          if (value && this._usbHotspotSetting) {
            this._incompatibleSettings(this.tetheringWifiKey,
              this.tetheringUsbKey, false);
          } else {
            this._setWifiTetheringSetting(value);
          }
          break;
        case this.tetheringUsbKey:
          // Early return if the user has disabled the setting or the
          // incompatible settings are disabled
          if (!value || (!this._hotspotSetting && !this._usbStorageSetting)) {
            this._setUsbTetheringSetting(value);
            return;
          }
          if (this._usbStorageSetting && this._hotspotSetting) {
            this._incompatibleSettings(this.tetheringUsbKey, null, true);
          } else {
            var oldSetting = this._usbStorageSetting ? this.usbStorageKey :
              this.tetheringWifiKey;
            this._incompatibleSettings(this.tetheringUsbKey, oldSetting, false);
          }
          break;
      }
    },

    reEnableWifiTetheringSetting: function() {
      if (!this.wifiHotspotSetting) {
        return;
      }

      // The time is used to avoid the quick changes on the toggle that may
      // cause bad user experience.
      this._setWifiTetheringSetting(false);
      setTimeout(() => {
        this._setWifiTetheringSetting(true);
      }, RE_ENABLE_WIFI_TETHERING_TIME);
    },

    /**
     * This is an internal function that can help us find out the matched
     * callback from catched listeners and remove it
     *
     * @memberOf Hotspot
     * @param {Array} listeners
     * @param {Function} callback
     */
    _removeEventListener: function(listeners, callback) {
      var index = listeners.indexOf(callback);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    },

    /**
     * This is an internal function that set a value to the
     * Wifi tethering setting
     *
     * @memberOf Hotspot
     * @param {Boolean} Setting value
     */
    _setWifiTetheringSetting: function(value) {
      var cset = {};
      cset[this.tetheringWifiKey] = value;
      this._settings.createLock().set(cset);
    },

    /**
     * This is an internal function that set a value to the
     * Usb tethering setting
     *
     * @memberOf Hotspot
     * @param {Boolean} Setting value
     */
    _setUsbTetheringSetting: function(value) {
      var cset = {};
      cset[this.tetheringUsbKey] = value;
      this._settings.createLock().set(cset);
    },

    addEventListener: function(eventName, callback) {
      if (eventName === 'incompatibleSettings') {
        this._incompatibleSettingsListeners.push(callback);
      } else if (eventName === 'wifiHotspotChange') {
        this._hotspotChangeListeners.push(callback);
      } else if (eventName === 'usbHotspotChange') {
        this._usbHotspotChangeListeners.push(callback);
      } else if (eventName === 'usbStorageChange') {
        this._usbStorageChangeListeners.push(callback);
      }
    },

    removeEventListener: function(eventName, callback) {
      if (eventName === 'incompatibleSettings') {
        this._removeEventListener(
          this._incompatibleSettingsListeners, callback);
      } else if (eventName === 'wifiHotspotChange') {
        this._removeEventListener(
          this._hotspotChangeListeners, callback);
      } else if (eventName === 'usbHotspotChange') {
        this._removeEventListener(
          this._usbHotspotChangeListeners, callback);
      } else if (eventName === 'usbStorageChange') {
        this._removeEventListener(
          this._usbStorageChangeListeners, callback);
      }
    },

    get wifiHotspotSetting() {
      return this._hotspotSetting;
    },

    get usbHotspotSetting() {
      return this._usbHotspotSetting;
    },

    get usbStorageSetting() {
      return this._usbStorageSetting;
    },

    set hotspotSetting(value) {
      this._setWifiTetheringSetting(value);
    },

    set usbHotspotSetting(value) {
      this._setUsbTetheringSetting(value);
    }
  };

  return function ctor_hotspot() {
    return new Hotspot();
  };
});

/**
 * Hotspot Settings:
 *   - Update Hotspot Settings
 * @module HotspotSettings
 */
define('panels/hotspot/hotspot_settings',['require','shared/settings_listener','modules/settings_cache','modules/base/module','modules/mvvm/observable'],function(require) {
  'use strict';

  var SettingsListener = require('shared/settings_listener');
  var SettingsCache = require('modules/settings_cache');
  var Module = require('modules/base/module');
  var Observable = require('modules/mvvm/observable');

  /**
   * @requires module:modules/mvvm/observable
   * @requires module:modules/settings_cache
   * @returns {HotspotSettings}
   */
  var HotspotSettings = Module.create(function HotspotSettings() {
    this.super(Observable).call(this);
    this._init();
  }).extend(Observable);

  /**
   * Hotspot SSID setting key
   *
   * @access public
   * @memberOf HotspotSettings
   * @type {String}
   */
  Object.defineProperty(HotspotSettings.prototype, 'tetheringSSIDKey', {
    get: function() {
      return 'tethering.wifi.ssid';
    }
  });

  /**
   * Hotspot security type setting key
   *
   * @access public
   * @memberOf HotspotSettings
   * @type {String}
   */
  Object.defineProperty(HotspotSettings.prototype, 'tetheringSecurityKey', {
    get: function() {
      return 'tethering.wifi.security.type';
    }
  });

  /**
   * Hotspot password setting key
   *
   * @access public
   * @memberOf HotspotSettings
   * @type {String}
   */
  Object.defineProperty(HotspotSettings.prototype, 'tetheringPasswordKey', {
    get: function() {
      return 'tethering.wifi.security.password';
    }
  });

  /**
   * Hotspot SSID.
   *
   * @access private
   * @memberOf HotspotSettings
   * @type {String}
   */
  Observable.defineObservableProperty(HotspotSettings.prototype,
    'hotspotSSID', {
      readonly: true,
      value: ''
  });

  /**
   * Hotspot security type
   *
   * @access private
   * @memberOf HotspotSettings
   * @type {String}
   */
  Observable.defineObservableProperty(HotspotSettings.prototype,
    'hotspotSecurity', {
      readonly: true,
      value: ''
  });

  /**
   * Hotspot Password
   *
   * @access private
   * @memberOf HotspotSettings
   * @type {String}
   */
  Observable.defineObservableProperty(HotspotSettings.prototype,
    'hotspotPassword', {
      readonly: true,
      value: ''
  });

  /**
   * Init module.
   *
   * @access private
   * @memberOf HotspotSettings
   */
  HotspotSettings.prototype._init = function() {
    this._settings = navigator.mozSettings;
    this._bindEvents();
    this._updatePasswordIfNeeded();
  };

  /**
   * We will generate a random password for the hotspot
   *
   * @access private
   * @memberOf HotspotSettings
   */
  HotspotSettings.prototype._generateHotspotPassword = function() {
    var words = ['amsterdam', 'ankara', 'auckland',
               'belfast', 'berlin', 'boston',
               'calgary', 'caracas', 'chicago',
               'dakar', 'delhi', 'dubai',
               'dublin', 'houston', 'jakarta',
               'lagos', 'lima', 'madrid',
               'newyork', 'osaka', 'oslo',
               'porto', 'santiago', 'saopaulo',
               'seattle', 'stockholm', 'sydney',
               'taipei', 'tokyo', 'toronto'];
    var password = words[Math.floor(Math.random() * words.length)];
    for (var i = 0; i < 4; i++) {
      password += Math.floor(Math.random() * 10);
    }
    return password;
  };

  /**
   * We will update hotspot password if needed
   *
   * @access private
   * @memberOf HotspotSettings
  */
  HotspotSettings.prototype._updatePasswordIfNeeded = function() {
    var self = this;
    SettingsCache.getSettings(function(results) {
      if (!results[self.tetheringPasswordKey]) {
        var pwd = self._generateHotspotPassword();
        self.setHotspotPassword(pwd);
      }
    });
  };

  /**
   * Sets the value to the tethering SSID setting
   *
   * @access public
   * @memberOf HotspotSettings
   * @param {String} value
   */
  HotspotSettings.prototype.setHotspotSSID = function(value) {
    var cset = {};
    cset[this.tetheringSSIDKey] = value;
    this._settings.createLock().set(cset);
  };

  /**
   * Sets the value to the tethering security type setting
   *
   * @access public
   * @memberOf HotspotSettings
   * @param {String} value
   */
  HotspotSettings.prototype.setHotspotSecurity = function(value) {
    var cset = {};
    cset[this.tetheringSecurityKey] = value;
    this._settings.createLock().set(cset);
  };

  /**
   * Sets the value to the tethering password setting
   *
   * @access private
   * @memberOf HotspotSettings
   * @param {String} value
   */
  HotspotSettings.prototype.setHotspotPassword = function(value) {
    var cset = {};
    cset[this.tetheringPasswordKey] = value;
    this._settings.createLock().set(cset);
  };

  /**
   * Updates the current value of hotspot SSID
   *
   * @access private
   * @memberOf HotspotSettings
   * @param {String} value
   */
  HotspotSettings.prototype._onSSIDChange = function(value) {
    this._hotspotSSID = value;
  };

  /**
   * Updates the current value of hotspot security type
   *
   * @access private
   * @memberOf HotspotSettings
   * @param {String} value
   */
  HotspotSettings.prototype._onSecurityChange = function(value) {
    this._hotspotSecurity = value;
  };

  /**
   * Updates the current value of hotspot password
   *
   * @access private
   * @memberOf HotspotSettings
   * @param {String} value
   */
  HotspotSettings.prototype._onPasswordChange = function(value) {
    this._hotspotPassword = value;
  };

  /**
   * Listen to hotspot settings changes
   *
   * @access private
   * @memberOf HotspotSettings
   */
  HotspotSettings.prototype._bindEvents = function() {
    SettingsListener.observe(this.tetheringSSIDKey,
      '', this._onSSIDChange.bind(this));

    SettingsListener.observe(this.tetheringSecurityKey,
      'wpa-psk', this._onSecurityChange.bind(this));

    SettingsListener.observe(this.tetheringPasswordKey,
      '', this._onPasswordChange.bind(this));
  };

  return HotspotSettings;
});

/* global openIncompatibleSettingsDialog */

define('panels/hotspot/panel',['require','modules/dialog_service','modules/settings_panel','panels/hotspot/hotspot','panels/hotspot/hotspot_settings'],function(require) {
  'use strict';

  var DialogService = require('modules/dialog_service');
  var SettingsPanel = require('modules/settings_panel');
  var Hotspot = require('panels/hotspot/hotspot');
  var HotspotSettings =
    require('panels/hotspot/hotspot_settings');

  return function ctor_hotspot() {
    var elements;
    var hotspot = Hotspot();
    var hotspotSettings = HotspotSettings();
    var hotspotSSID;

    return SettingsPanel({
      onInit: function(panel) {
        this._incompatibleSettingsDialog = 'incompatible-settings-dialog';

        elements = {
          panel: panel,
          hotspotSettingBtn:
            panel.querySelector('#hotspot-settings-section a'),
          hotspotElement:
            panel.querySelector('#tethering-wifi-enabled'),
          hotspotMsg:
            panel.querySelector('#wifi-hotspot-msg'),
          usbTetheringElement:
            panel.querySelector('#tethering-usb-enabled')
        };

        this.incompatibleSettingsHandler =
          this._openIncompatibleSettingsDialog.bind(this);

        hotspot.init();
      },

      onBeforeShow: function(panel, options) {
        // Wifi tethering enabled
        hotspot.addEventListener('wifiHotspotChange',
          this._setHotspotSettingsEnabled);

        // USB tethering enabled
        hotspot.addEventListener('usbHotspotChange',
          this._setUSBTetheringCheckbox);

        // Incompatible settings
        hotspot.addEventListener('incompatibleSettings',
          this.incompatibleSettingsHandler);

        // Wi-fi hotspot event listener
        elements.hotspotElement.addEventListener('change',
          this._onWifiHotspotChange);

        // USB tethering event listener
        elements.usbTetheringElement.addEventListener('change',
          this._onUsbHotspotChange);

        elements.hotspotSettingBtn.addEventListener('click',
          this._onHotspotSettingsClick);

        hotspotSettings.observe('hotspotSSID', this._updateHotspotSSID);

        this._updateUI();
      },

      onBeforeHide: function(panel, options) {
        // Wifi tethering
        hotspot.removeEventListener('wifiHotspotChange',
          this._setHotspotSettingsEnabled);

        // USB tethering
        hotspot.removeEventListener('usbHotspotChange',
          this._setUSBTetheringCheckbox);

        // Incompatible settings
        hotspot.removeEventListener('incompatibleSettings',
          this.incompatibleSettingsHandler);

        // Wi-fi hotspot event listener
        elements.hotspotElement.removeEventListener('change',
          this._onWifiHotspotChange);

        // USB tethering event listener
        elements.usbTetheringElement.removeEventListener('change',
          this._onUsbHotspotChange);

        elements.hotspotSettingBtn.removeEventListener('click',
          this._onHotspotSettingsClick);

        hotspotSettings.unobserve('hotspotSSID');
      },

      _updateHotspotSSID: function(newValue) {
        hotspotSSID = newValue;
      },

      _setHotspotSettingsEnabled: function(enabled) {
        elements.hotspotElement.checked = enabled;
        if (enabled) {
          navigator.mozL10n.setAttributes(
            elements.hotspotMsg,
            'wifi-hotspot-enabled-msg',
            { hotspotSSID: hotspotSSID }
          );
        } else {
          elements.hotspotMsg.setAttribute('data-l10n-id', 'disabled');
        }
      },

      _setUSBTetheringCheckbox: function(enabled) {
        elements.usbTetheringElement.checked = enabled;
      },

      _onWifiHotspotChange: function(event) {
        var checkbox = event.target;
        hotspot.checkIncompatibleSettings(
          hotspot.tetheringWifiKey, checkbox.checked);
      },

      _onUsbHotspotChange: function(event) {
        var checkbox = event.target;
        hotspot.checkIncompatibleSettings(
          hotspot.tetheringUsbKey, checkbox.checked);
      },

      _onHotspotSettingsClick: function() {
        DialogService.show('hotspot-wifiSettings', {
          settings: hotspotSettings
        }).then((result) => {
          if (result.type === 'submit') {
            // reconnect hotspot settings to make new settings take effect.
            hotspot.reEnableWifiTetheringSetting();
          }
        });
      },

      _openIncompatibleSettingsDialog:
        function(newSetting, oldSetting, bothConflicts) {
          // We must check if there is two incompatibilities
          // (usb hotspot case) or just one
          if (bothConflicts) {
            openIncompatibleSettingsDialog(this._incompatibleSettingsDialog,
              hotspot.tetheringUsbKey, hotspot.tetheringWifiKey,
              this._openSecondWarning.bind(this));
          } else {
            openIncompatibleSettingsDialog(this._incompatibleSettingsDialog,
              newSetting, oldSetting, null);
          }
      },

      _openSecondWarning: function() {
        openIncompatibleSettingsDialog(this._incompatibleSettingsDialog,
            hotspot.tetheringUsbKey, hotspot.usbStorageKey,
            null);
      },

      _updateUI: function() {
        this._setHotspotSettingsEnabled(
          hotspot.wifiHotspotSetting
        );
        this._setUSBTetheringCheckbox(
          hotspot.usbHotspotSetting
        );
        this._updateHotspotSSID(hotspotSettings.hotspotSSID);
      }
    });
  };
});

