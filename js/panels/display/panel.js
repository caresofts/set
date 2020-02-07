/**
 * Handle display panel functionality, which will change the value of
 * screen.automatic-brightness of settings.
 *
 * @module display/display
 */
define('panels/display/display',['require','shared/settings_listener'],function(require) {
  'use strict';

  var SettingsListener = require('shared/settings_listener');

  /**
   * @alias module:display/display
   * @class Display
   * @returns {Display}
   */
  var Display = function() {
    this.elements = null;
  };

  Display.prototype = {
    /**
     * Init Display module with doms and data of device-features.json.
     *
     * @access public
     * @memberOf Display.prototype
     * @param {HTMLElement} elements
     * @param {Object} data
     *                 content of resources/device-features.json.
     */
    init: function d_init(elements, data) {
      this.elements = elements;
      this.initBrightnessItems(data);
    },

    /**
     * Decide whether to show brightnessAuto and brightnessManual options.
     *
     * @access public
     * @memberOf Display.prototype
     * @param {Object} data
     *                 content of resources/device-features.json.
     */
    initBrightnessItems: function d_init_brightness_items(data) {
      var autoBrightnessSetting = 'screen.automatic-brightness';

      if (data.ambientLight) {
        this.elements.brightnessAuto.hidden = false;
        SettingsListener.observe(autoBrightnessSetting, false, function(value) {
          this.elements.brightnessManual.hidden = value;
        }.bind(this));
      } else {
        this.elements.brightnessAuto.hidden = true;
        this.elements.brightnessManual.hidden = false;
        var cset = {};
        cset[autoBrightnessSetting] = false;
        SettingsListener.getSettingsLock().set(cset);
      }
    }
  };

  return function ctor_display() {
    return new Display();
  };
});

/**
 * The display panel allow user to modify timeout forscreen-off, brightness.
 */
define('panels/display/panel',['require','modules/settings_panel','panels/display/display','shared/lazy_loader'],function(require) {
  'use strict';

  var SettingsPanel = require('modules/settings_panel');
  var DisplayModule = require('panels/display/display');
  var LazyLoader = require('shared/lazy_loader');

  var displayElements = {};

  return function ctor_display_panel() {
    var display = DisplayModule();

    return SettingsPanel({
      onInit: function dp_onInit(panel) {
        displayElements = {
          brightnessManual: panel.querySelector('.brightness-manual'),
          brightnessAuto: panel.querySelector('.brightness-auto')
        };

        LazyLoader.getJSON('/resources/device-features.json')
        .then(function(data) {
          display.init(displayElements, data);
        });
      }
    });
  };
});

