/**
 * Handle HardwareInfo related functionality
 *
 * @module about/HardwareInfo
 */
define('panels/about/hardware_info',['require'],function(require) {
  'use strict';

  /**
   * @alias module:about/HardwareInfo
   * @class HardwareInfo
   * @returns {HardwareInfo}
   */
  var HardwareInfo = function() {
    this._elements = null;
  };

  HardwareInfo.prototype = {
    /**
     * initialization.
     *
     * @access public
     * @memberOf HardwareInfo.prototype
     * @param {HTMLElement} elements
     */
    init: function hi_init(elements) {
      this._elements = elements;

      this._loadHardwareInfo();
    },

    /**
     * Load hardware related informations.
     *
     * @access private
     * @memberOf HardwareInfo.prototype
     */
    _loadHardwareInfo: function hi__loadHardwareInfo() {
      var _conns = navigator.mozMobileConnections;
      if (!_conns) {
        this._elements.deviceInfoPhoneNum.hidden = true;
        return;
      }

      var _isMultiSim = _conns.length > 1;
      // Only show the list item when there are valid iccinfos.
      var _hideListItem = true;

      // update msisdns
      while (this._elements.deviceInfoMsisdns.hasChildNodes()) {
        this._elements.deviceInfoMsisdns.removeChild(
          this._elements.deviceInfoMsisdns.lastChild);
      }

      Array.prototype.forEach.call(_conns, function(conn, index) {
        var iccId = conn.iccId;
        if (!iccId) {
          return;
        }

        var iccObj = navigator.mozIccManager.getIccById(iccId);
        if (!iccObj) {
          return;
        }

        var iccInfo = iccObj.iccInfo;
        if (!iccInfo) {
          return;
        }

        _hideListItem = false;
        var span = this._renderPhoneNumberElement(iccInfo, index, _isMultiSim);
        this._elements.deviceInfoMsisdns.appendChild(span);
      }.bind(this));

      this._elements.deviceInfoPhoneNum.hidden = _hideListItem;
    },

    /**
     * render phone number element based on SIM card info.
     *
     * If the icc card is gsm card, the phone number is in msisdn.
     * Otherwise, the phone number is in mdn.
     *
     * @access private
     * @memberOf HardwareInfo.prototype
     * @param {Object} iccInfo iccInfo data
     * @param {Number} index index number
     * @param {Boolean} isMultiSim has multiple SIM
     * @return {HTMLElement} span element with number info
     */
    _renderPhoneNumberElement: function hi__renderPhoneNumberElement(
      iccInfo, index, isMultiSim) {
        var span = document.createElement('span');
        var msisdn = iccInfo.msisdn || iccInfo.mdn;
        if (msisdn) {
          if (isMultiSim) {
            navigator.mozL10n.setAttributes(span,
              'deviceInfo-MSISDN-with-index', {
                index: index + 1,
                msisdn: msisdn
            });
          } else {
            span.textContent = msisdn;
          }
        } else {
          if (isMultiSim) {
            navigator.mozL10n.setAttributes(span,
              'unknown-phoneNumber-sim', { index: index + 1 });
          } else {
            span.setAttribute('data-l10n-id', 'unknown-phoneNumber');
          }
        }
        return span;
    }
  };

  return function ctor_hardwareInfo() {
    return new HardwareInfo();
  };
});

/**
 * Handle Update check related functionality
 *
 * @module about/UpdateCheck
 */
define('panels/about/update_check',['require'],function(require) {
  'use strict';

  /**
   * @alias module:about/UpdateCheck
   * @class UpdateCheck
   * @returns {UpdateCheck}
   */
  var UpdateCheck = function() {
    this._elements = null;
    this._settings = window.navigator.mozSettings;
    this._checkStatus = {
      'gecko.updateStatus': {},
      'apps.updateStatus': {}
    };
  };

  UpdateCheck.prototype = {
    /**
     * initialization.
     *
     * @access public
     * @memberOf UpdateCheck.prototype
     * @param {HTMLElement} elements
     */
    init: function uc_init(elements) {
      this._elements = elements;

      this._loadLastUpdated();

      this._displayNotifyCheckbox();

      this._elements.checkUpdateNow.addEventListener('click',
        this._checkForUpdates.bind(this));
    },

    /**
     * Shows and hides the "notify me" checkbox depending on whether auto
     * updates are enabled.
     *
     * @access private
     * @memberOf UpdateCheck.prototype
     */
    _displayNotifyCheckbox: function uc__displayNotifyCheckBox() {
      var key = 'addons.auto_update';
      var request = this._settings.createLock().get(key);

      request.onsuccess = () => {
        this._elements.addonUpdateNotify
          .classList.toggle('hidden', !request.result[key]);

        this._settings.addObserver(key, e => {
          this._elements.addonUpdateNotify
            .classList.toggle('hidden', !e.settingValue);
        });
      };

      request.onerror = err => {
        console.error('Failed to fetch ', key, err);
      };
    },

    /**
     * Show last update date.
     *
     * @access private
     * @memberOf UpdateCheck.prototype
     */
    _loadLastUpdated: function uc__loadLastUpdated() {
      var key = 'deviceinfo.last_updated';
      var request = this._settings.createLock().get(key);

      request.onsuccess = function() {
        var lastUpdated = request.result[key];
        if (!lastUpdated) {
          return;
        }

        this._elements.lastUpdateDate.textContent =
          new Date(lastUpdated).toLocaleString(navigator.languages, {
            hour12: navigator.mozHour12,
            hour: 'numeric',
            minute: 'numeric',
            day: 'numeric',
            month: 'numeric',
            year: 'numeric'
          });
      }.bind(this);
    },

    /**
     * update result based on return states
     *
     * @access private
     * @memberOf UpdateCheck.prototype
     */
    _statusCompleteUpdater: function uc__statusCompleteUpdater() {
      var hasAllCheckComplete =
        Object.keys(this._checkStatus).some((setting) =>
          this._checkStatus[setting].value === 'check-complete'
        );

      var hasAllResponses =
        Object.keys(this._checkStatus).every((setting) =>
          !!this._checkStatus[setting].value
        );

      if (hasAllCheckComplete) {
        this._startClearUpdateStatus();
      }

      // On no-updates we should also remove the checking class.
      var hasNoUpdatesResult =
        Object.keys(this._checkStatus).some((setting) =>
          this._checkStatus[setting].value === 'no-updates'
        );

      if (hasAllResponses || hasNoUpdatesResult) {
        this._elements.updateStatus.classList.remove('checking');
      }
    },

    /**
     * handler for update status.
     *
     * @access private
     * @memberOf UpdateCheck.prototype
     * @param  {String} setting gecko or app setting
     * @param  {Object} event   event contains SettingValue
     */
    _onUpdateStatus: function uc__onUpdateStatus(setting, event) {
      var value = event.settingValue;
      this._checkStatus[setting].value = value;

      /**
       * possible return values:
       *
       * - for system updates:
       *   - no-updates
       *   - already-latest-version
       *   - check-complete
       *   - retry-when-online
       *   - check-error-$nsresult
       *   - check-error-http-$code
       *
       * - for apps updates:
       *   - check-complete
       *
       * use
       * http://mxr.mozilla.org/mozilla-central/ident?i=setUpdateStatus&tree=mozilla-central&filter=&strict=1
       * to check if this is still current
       */

      var l10nValues = [
        'no-updates', 'already-latest-version', 'retry-when-online'];

      if (value !== 'check-complete') {
        var id = l10nValues.indexOf(value) !== -1 ? value : 'check-error';
        this._elements.systemStatus.setAttribute('data-l10n-id', id);
        if (id === 'check-error') {
          console.error('Error checking for system update:', value);
        }
      }

      this._statusCompleteUpdater();

      this._settings.removeObserver(setting, this._checkStatus[setting].cb);
      this._checkStatus[setting].cb = null;
    },

    /**
     * Timer to keep track of displayed update status
     *
     * @access private
     * @memberOf UpdateCheck.prototype
     */
    _clearUpdateStatusTimer: null,

    /**
     * Start timer to hide the update status, ensuring it is displayed
     * for a certain period of time.
     *
     * @access private
     * @memberOf UpdateCheck.prototype
     */
    _startClearUpdateStatus: function uc__clearUpdateStatus() {
      if (this._clearUpdateStatusTimer) {
        clearTimeout(this._clearUpdateStatusTimer);
      }
      this._clearUpdateStatusTimer =
        window.setTimeout(this._doClearUpdateStatus.bind(this), 5000);
    },

    /**
     * Actually hide the update status
     *
     * @access private
     * @memberOf UpdateCheck.prototype
     */
    _doClearUpdateStatus: function uc__clearUpdateStatus() {
      this._elements.updateStatus.classList.remove('visible');
      this._elements.systemStatus.textContent = '';
    },

    /**
     * Check if there's any update.
     *
     * @access private
     * @memberOf UpdateCheck.prototype
     */
    _checkForUpdates: function uc__checkForUpdates() {
      if (!navigator.onLine) {
        this._elements.checkUpdateNow.setAttribute('disabled', 'disabled');
        navigator.mozL10n.formatValue('no-network-when-update').then(msg => {
          alert(msg);
          this._elements.checkUpdateNow.removeAttribute('disabled');
        });
        return;
      }

      this._elements.updateStatus.classList.add('checking', 'visible');

      /* remove whatever was there before */
      this._elements.systemStatus.textContent = '';

      for (var setting in this._checkStatus) {
        this._checkStatus[setting].cb =
          this._onUpdateStatus.bind(this, setting);
        this._settings.addObserver(setting, this._checkStatus[setting].cb);
      }

      this._settings.createLock().set({
        'gaia.system.checkForUpdates': true
      });
    }
  };

  return function ctor_updateCheck() {
    return new UpdateCheck();
  };
});

/**
 * Handle factory reset functionality
 *
 * @module about/FactoryReset
 */
define('panels/about/factory_reset',['require'],function(require) {
  'use strict';

  /**
   * @alias module:about/FactoryReset
   * @class FactoryReset
   * @returns {FactoryReset}
   */
  var FactoryReset = function() {
    this._elements = null;
  };

  FactoryReset.prototype = {
    /**
     * initialization
     *
     * @access public
     * @memberOf FactoryReset.prototype
     * @param {HTMLElement} elements
     */
    init: function fr_init(elements) {
      this._elements = elements;
      if (navigator.mozPower) {
        this._elements.resetButton.disabled = false;
        this._elements.resetButton.addEventListener('click',
          this._resetClick.bind(this));
      } else {
        // disable button if mozPower is undefined or can't be used
        this._elements.resetButton.disabled = true;
      }
    },

    /**
     * click handler.
     *
     * @access private
     * @memberOf FactoryReset.prototype
     */
    _resetClick: function fr__resetClick() {
      this._elements.resetDialog.hidden = false;
      this._elements.resetCancel.onclick = function() {
        this._elements.resetDialog.hidden = true;
      }.bind(this);
      this._elements.resetConfirm.onclick = function() {
        this._factoryReset();
        this._elements.resetDialog.hidden = true;
      }.bind(this);
    },

    /**
     * call mozPower API to reset device
     *
     * @access private
     * @memberOf FactoryReset.prototype
     */
    _factoryReset: function fr__factoryReset() {
      var power = navigator.mozPower;
      if (!power) {
        console.error('Cannot get mozPower');
        return;
      }

      if (!power.factoryReset) {
        console.error('Cannot invoke mozPower.factoryReset()');
        return;
      }

      power.factoryReset();
    }
  };

  return function ctor_factoryReset() {
    return new FactoryReset();
  };
});

/**
 * Used to show Device/Information panel
 */
define('panels/about/panel',['require','modules/settings_panel','panels/about/hardware_info','panels/about/update_check','panels/about/factory_reset'],function(require) {
  'use strict';

  var SettingsPanel = require('modules/settings_panel');
  var HardwareInfo = require('panels/about/hardware_info');
  var UpdateCheck = require('panels/about/update_check');
  var FactoryReset = require('panels/about/factory_reset');

  return function ctor_support_panel() {
    var hardwareInfo = HardwareInfo();
    var factoryReset = FactoryReset();
    var updateCheck = UpdateCheck();

    return SettingsPanel({
      onInit: function(panel) {
        hardwareInfo.init({
          deviceInfoPhoneNum: panel.querySelector('.deviceinfo-phone-num'),
          deviceInfoMsisdns: panel.querySelector('.deviceInfo-msisdns')
        });

        updateCheck.init({
          checkUpdateNow: panel.querySelector('.check-update-now'),
          lastUpdateDate: panel.querySelector('.last-update-date'),
          updateStatus: panel.querySelector('.update-status'),
          systemStatus: panel.querySelector('.system-update-status'),
          addonUpdateNotify: panel.querySelector('.addon-update-notify')
        });

        factoryReset.init({
          resetButton: panel.querySelector('.reset-phone'),
          resetDialog: panel.querySelector('.reset-phone-dialog'),
          resetConfirm: panel.querySelector('.confirm-reset-phone'),
          resetCancel: panel.querySelector('.cancel-reset-phone')
        });
      }
    });
  };
});

