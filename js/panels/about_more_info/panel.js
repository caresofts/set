/**
 * Show software informations
 *
 * @module abou_more_info/commitInfo
 */
define('panels/about_more_info/commit_info',['require'],function(require) {
  'use strict';

  /**
   * @alias module:abou_more_info/commitInfo
   * @class commitInfo
   * @returns {commitInfo}
   */
  var commitInfo = function() {
    this._elements = {};
  };

  commitInfo.prototype = {
    /**
     * initialization.
     *
     * @access public
     * @memberOf commitInfo.prototype
     * @param {HTMLElement} elements
     */
    init: function mi_init(elements) {
      this._elements = elements;

      this._loadGaiaCommit();
    },

    /**
     * convert date to UTC format.
     *
     * @access private
     * @memberOf commitInfo.prototype
     */
    _dateToUTC: function mi__dateToUTC(d) {
      var arr = [];
      [
        d.getUTCFullYear(), (d.getUTCMonth() + 1), d.getUTCDate(),
        d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()
      ].forEach(function(n) {
        arr.push((n >= 10) ? n : '0' + n);
      });
      return arr.splice(0, 3).join('-') + ' ' + arr.join(':');
    },

    /**
     * show Gaia commit number.
     *
     * @access private
     * @memberOf commitInfo.prototype
     */
    _loadGaiaCommit: function mi__loadGaiaCommit() {
      const GAIA_COMMIT = 'resources/gaia_commit.txt';

      if (this._elements.dispHash.textContent) {
        return; // `gaia-commit.txt' has already been loaded
      }

      var req = new XMLHttpRequest();
      req.onreadystatechange = (function(e) {
        if (req.readyState === 4) {
          if (req.status === 0 || req.status === 200) {
            var data = req.responseText.split('\n');

            /**
             * XXX it would be great to pop a link to the github page
             * showing the commit, but there doesn't seem to be any way to
             * tell the browser to do it.
             */

            var d = new Date(parseInt(data[1] + '000', 10));
            this._elements.dispDate.textContent = this._dateToUTC(d);
            this._elements.dispHash.textContent = data[0].substr(0, 8);
          } else {
            console.error('Failed to fetch gaia commit: ', req.statusText);
          }
        }
      }).bind(this);

      req.open('GET', GAIA_COMMIT, true); // async
      req.responseType = 'text';
      req.send();
    }
  };

  return function ctor_commitInfo() {
    return new commitInfo();
  };
});

/**
 * Show hardware informations
 *
 * @module about_more_info/hardwareInfo
 */
define('panels/about_more_info/hardware_info',['require','shared/settings_listener','modules/bluetooth/bluetooth_context'],function(require) {
  'use strict';

  var SettingsListener = require('shared/settings_listener');
  var BtContext = require('modules/bluetooth/bluetooth_context');

  /**
   * @alias module:about_more_info/HardwareInfo
   * @class HardwareInfo
   * @returns {HardwareInfo}
   */
  var HardwareInfo = function() {
    this._elements = {};
  };

  HardwareInfo.prototype = {
    /**
     * initialization.
     *
     * @access public
     * @memberOf HardwareInfo.prototype
     * @param {HTMLElement} elements
     */
    init: function mi_init(elements) {
      this._elements = elements;

      this._loadMacAddress();
      this._loadBluetoothAddress();
    },

    /**
     * observe and show MacAddress.
     *
     * @access private
     * @memberOf HardwareInfo.prototype
     */
    _loadMacAddress: function mi__loadMacAddress() {
      SettingsListener.observe('deviceinfo.mac', '', (macAddress) =>
        this._elements.deviceInfoMac.textContent = macAddress);
    },

    /**
     * refreshing the address field only.
     *
     * @access private
     * @memberOf HardwareInfo.prototype
     * @param  {String} address Bluetooth address
     */
    _refreshBluetoothAddress: function mi__refreshBluetoothAddress(address) {
      // update btAddr
      if (address == null || address === '') {
        this._elements.btAddr.setAttribute('data-l10n-id',
                                           'bluetooth-address-unavailable');
      } else {
        this._elements.btAddr.removeAttribute('data-l10n-id');
        this._elements.btAddr.textContent = address;
      }
    },

    /**
     * load Bluetooth address.
     *
     * @access private
     * @memberOf HardwareInfo.prototype
     */
    _loadBluetoothAddress: function about_loadBluetoothAddress() {
      BtContext.observe('address', this._refreshBluetoothAddress.bind(this));
      this._refreshBluetoothAddress(BtContext.address);
    }
  };

  return function ctor_hardwareInfo() {
    return new HardwareInfo();
  };
});

/**
 * Show misc informations
 *
 * @module abou_more_info/DeviceInfo
 */
define('panels/about_more_info/device_info',['require'],function(require) {
  'use strict';

  /** MMI control code used for retrieving a devices's IMEI code. */
  const GET_IMEI_COMMAND = '*#06#';

  /**
   * @alias module:abou_more_info/DeviceInfo
   * @class DeviceInfo
   * @returns {DeviceInfo}
   */
  var DeviceInfo = function() {
    this._elements = {};
  };

  DeviceInfo.prototype = {
    /**
     * initialization.
     *
     * @access public
     * @memberOf DeviceInfo.prototype
     * @param {HTMLElement} elements
     */
    init: function mi_init(elements) {
      this._elements = elements;

      this._loadImei();
      this._loadIccId();
    },

    /**
     * Retrieves the IMEI code corresponding with the specified SIM card slot.
     *
     * @access private
     * @memberOf DeviceInfo.prototype
     * @param {Integer} simSlotIndex The slot whose IMEI code
     *   we want to retrieve.
     * @return {Promise} A promise that resolves to the IMEI code or rejects
     *          if an error occurred.
     */
    _getImeiCode: function mi__getImeiCode(simSlotIndex) {
      var dialPromise = navigator.mozTelephony.dial(GET_IMEI_COMMAND,
        simSlotIndex);

      return dialPromise.then(function about_dialImeiPromise(call) {
        return call.result.then(function(result) {
          if (result && result.success &&
            (result.serviceCode === 'scImei')) {
            return result.statusMessage;
          } else {
            var errorMsg = 'Could not retrieve the IMEI code for SIM ' +
              simSlotIndex;
            console.log(errorMsg);
            return Promise.reject(
              new Error(errorMsg)
            );
          }
        });
      });
    },

    /**
     * Populate the IMEI information entry with the provided list of IMEI codes.
     * If the code is not given or if it's empty then the entry will be marked
     * as unavailable.
     *
     * @access private
     * @memberOf DeviceInfo.prototype
     * @param {Array} imeis An array of IMEI codes.
     */
    _createImeiField: function mi__createImeiField(imeis) {
      while (this._elements.deviceInfoImeis.hasChildNodes()) {
        this._elements.deviceInfoImeis.removeChild(
          this._elements.deviceInfoImeis.lastChild);
      }

      if (!imeis || imeis.length === 0) {
        var span = document.createElement('span');

        span.setAttribute('data-l10n-id', 'unavailable');
        this._elements.deviceInfoImeis.appendChild(span);
      } else {
        imeis.forEach(function(imei, index) {
          var span = document.createElement('span');

          if (imeis.length > 1) {
            navigator.mozL10n.setAttributes(span,
              'deviceInfo-IMEI-with-index', {
                index: index + 1,
                imei: imei
            });
          } else {
            span.textContent = imei;
          }

          span.dataset.slot = index;
          this._elements.deviceInfoImeis.appendChild(span);
        }.bind(this));
      }
    },

    /**
     * Loads all the device's IMEI code in the corresponding entry.
     *
     * @access private
     * @memberOf DeviceInfo.prototype
     * @return {Promise} A promise that is resolved when the container has been
     *          fully populated.
     */
    _loadImei: function mi__loadImei() {
      var conns = navigator.mozMobileConnections;

      if (!navigator.mozTelephony || !conns) {
        this._elements.listImeis.hidden = true;
        return Promise.resolve();
      }

      // Retrieve all IMEI codes.
      var promises = [];
      for (var i = 0; i < conns.length; i++) {
        promises.push(this._getImeiCode(i));
      }

      var self = this;
      return Promise.all(promises).then(function(imeis) {
        self._createImeiField(imeis);
      }, function() {
        self._createImeiField(null);
      });
    },

    /**
     * show icc id.
     *
     * @access private
     * @memberOf DeviceInfo.prototype
     */
    _loadIccId: function mi__loadIccId() {
      var conns = navigator.mozMobileConnections;

      if (!navigator.mozTelephony || !conns) {
        this._elements.listIccIds.hidden = true;
        return;
      }

      var multiSim = conns.length > 1;

      // update iccids
      while (this._elements.deviceInfoIccIds.hasChildNodes()) {
        this._elements.deviceInfoIccIds.removeChild(
          this._elements.deviceInfoIccIds.lastChild);
      }
      Array.prototype.forEach.call(conns, function(conn, index) {
        var span = document.createElement('span');
        if (conn.iccId) {
          if (multiSim) {
            navigator.mozL10n.setAttributes(span,
              'deviceInfo-ICCID-with-index', {
                index: index + 1,
                iccid: conn.iccId
            });
          } else {
            span.textContent = conn.iccId;
          }
        } else {
          if (multiSim) {
            navigator.mozL10n.setAttributes(span,
              'deviceInfo-ICCID-unavailable-sim', {
                index: index + 1
            });
          } else {
            span.setAttribute('data-l10n-id', 'unavailable');
          }
        }
        this._elements.deviceInfoIccIds.appendChild(span);
      }.bind(this));
    }
  };

  return function ctor_deviceInfo() {
    return new DeviceInfo();
  };
});

/**
 * Used to show Device/Information/More Information panel
 */
define('panels/about_more_info/panel',['require','modules/settings_panel','panels/about_more_info/commit_info','panels/about_more_info/hardware_info','panels/about_more_info/device_info'],function(require) {
  'use strict';

  var SettingsPanel = require('modules/settings_panel');
  var CommitInfo = require('panels/about_more_info/commit_info');
  var HardwareInfo = require('panels/about_more_info/hardware_info');
  var DeviceInfo = require('panels/about_more_info/device_info');

  return function ctor_support_panel() {
    var commitInfo = CommitInfo();
    var hardwareInfo = HardwareInfo();
    var deviceInfo = DeviceInfo();

    return SettingsPanel({
      onInit: function(panel) {
        deviceInfo.init({
          listImeis: panel.querySelector('.list-imeis'),
          listIccIds: panel.querySelector('.list-iccids'),
          deviceInfoImeis: panel.querySelector('.deviceInfo-imeis'),
          deviceInfoIccIds: panel.querySelector('.deviceInfo-iccids')
        });

        commitInfo.init({
          dispDate: panel.querySelector('.gaia-commit-date'),
          dispHash: panel.querySelector('.gaia-commit-hash')
        });

        hardwareInfo.init({
          deviceInfoMac: panel.querySelector('[data-name="deviceinfo.mac"]'),
          btAddr: panel.querySelector('[data-name="deviceinfo.bt_address"]')
        });
      }
    });
  };
});

