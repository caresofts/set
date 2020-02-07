/* global openLink */
/**
 * Handle support panel functionality with SIM and without SIM
 */
define('panels/help/support',['require','modules/settings_cache','shared/lazy_loader'],function(require) {
  'use strict';
  var SettingsCache = require('modules/settings_cache');
  var LazyLoader = require('shared/lazy_loader');

  var Support = function() {};

  Support.prototype = {
    /**
     * initialization
     */
    init: function support_init(elements) {
      this._elements = elements;
      /**
       * We'll stash the support info in here when reading from the
       * Settings.
       * If no values are found in Settings for support info We'll
       * refer to the JSON File Data.
       */
      this._callSupportInfo = null;
      var url = 'http://support.mozilla.org/products/firefox-os';
      this._elements.userGuide.onclick =
        function openUserGuide() { openLink(url); };

      // parse support information from data
      this._getSupportInfo(this._displaySupportInfo.bind(this));
    },
    /**
     * Clean states for test
     */
    uninit: function() {
      this._elements = null;
      this._supportInfo = null;
      this._callSupportInfo = null;
    },
    /**
     * get support data from cache or from resource file
     */
    _getSupportInfo: function support_getSupportInfo(callback) {
      if (this._supportInfo) {
        callback(this._supportInfo);
        return;
      }
      LazyLoader.getJSON('/resources/support.json')
      .then(function loadSupportInfo(data) {
        this._supportInfo = data;
        callback(this._supportInfo);
      }.bind(this));
    },
    /**
     * create support url items
     */
    _createLinkNode: function support_createLinkNode(data, type) {
      var link = document.createElement('a');
      link.setAttribute('href', data.href);
      link.classList.add('link-text');
      if (type == 'tel') {
        link.textContent = data.title + ' (' + data.href + ')';
      } else {
        link.textContent = data.title;
      }
      return link;
    },
    /**
     * Indicate to our panel that there is support info present.
     */
    _enableSupportInfo: function support_enableSupportInfo() {
      this._elements.help.dataset.hasSupportInfo = true;
    },
    /**
     * Local helper function to set the online support information
     * once it's retrieved or we've determined that we'll use
     * what's in the build JSON file.
     */
    _setOnlineSupportInfo:
      function support_setOnlineSupportInfo(onlineSupportInfo) {
      this._enableSupportInfo();
      var nodes = this._createLinkNode(onlineSupportInfo);
      this._elements.supportText.appendChild(nodes);
    },
    /**
     * Local helper function to set the information once we've
     * retrieved it.
     */
    _setCallSupportInfo:
      function support_setCallSupportInfo(supportInfo) {
      this._enableSupportInfo();
      for (var id in supportInfo) {
        this._elements.supportNumber
          .appendChild(this._createLinkNode(supportInfo[id], 'tel'));
      }
    },
    _renderSupportInfo: function support_renderSupportInfo(result) {
      var onlineSupportInfo = null;
      var onlineSupportTitle = result['support.onlinesupport.title'];
      if (onlineSupportTitle !== '') {
        onlineSupportInfo = { title: onlineSupportTitle };
        onlineSupportInfo.href = result['support.onlinesupport.href'];
        this._setOnlineSupportInfo(onlineSupportInfo);
      } else if (this._supportInfo) {
        this._setOnlineSupportInfo(this._supportInfo.onlinesupport);
      }

      // Check to see if we have a title for the first support number.
      var callSupport1Title = result['support.callsupport1.title'];
      // If we have a title we'll go ahead and load the href for it too.
      if (callSupport1Title !== '') {
        this._callSupportInfo = [
          {
            'title': callSupport1Title,
            'href': result['support.callsupport1.href']
          }
        ];

        // Now check to see if we have a title for the second
        // support number. If we do, we'll load it's href as well.
        var callSupport2Title = result['support.callsupport2.title'];
        if (callSupport2Title !== '') {
          this._callSupportInfo.push({
              'title': callSupport2Title,
              'href': result['support.callsupport2.href']
          });
          // Finally set the support info retreived from Settings.
          this._setCallSupportInfo(this._callSupportInfo);
        }
      } else if (this._supportInfo) {
        // No customized values, use what's in the JSON file.
        this._setCallSupportInfo(this._supportInfo.callsupport);
      }
    },
    /**
     * display Support information
     */
    _displaySupportInfo: function support_displaySupportInfo(supportInfo) {
      SettingsCache.getSettings(this._renderSupportInfo.bind(this));
    }
  };
  return function ctor_support() {
    return new Support();
  };
});

/**
 * Used to show Device/Help panel
 */
define('panels/help/panel',['require','modules/settings_panel','panels/help/support'],function(require) {
  'use strict';

  var SettingsPanel = require('modules/settings_panel');
  var Support = require('panels/help/support');

  return function ctor_support_panel() {
    var help = Support();

    return SettingsPanel({
      onInit: function(panel) {
        var elements = {
          userGuide: panel.querySelector('#user-guide'),
          help: panel,
          supportText: panel.querySelector('#help-online-support-text'),
          supportNumber: panel.querySelector('#help-call-support-numbers')
        };
        help.init(elements);
      }
    });
  };
});

