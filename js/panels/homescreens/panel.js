/* global MozActivity */
/**
 * Wallpaper:
 *   - Select wallpaper by calling wallpaper.selectWallpaper.
 *   - Update wallpaperSrc if wallpaper.image is changed, which is watched
 *     by Observable module.
 * Wallpaper handles only data and does not involve in any UI logic.
 *
 * @module Wallpaper
 */
define('panels/homescreens/wallpaper',['require','shared/settings_listener','shared/settings_url','shared/omadrm/fl','modules/base/module','modules/mvvm/observable'],function(require) {
  'use strict';

  const WALLPAPER_KEY = 'wallpaper.image';

  var SettingsListener = require('shared/settings_listener');
  var SettingsURL = require('shared/settings_url');
  var ForwardLock = require('shared/omadrm/fl');
  var Module = require('modules/base/module');
  var Observable = require('modules/mvvm/observable');

  var Wallpaper = Module.create(function Wallpaper() {
    this.super(Observable).call(this);
    this._init();
  }).extend(Observable);

  /**
   * Source path of wallpaper.
   *
   * @memberOf Wallpaper
   * @type {String}
   * @public
   */
  Observable.defineObservableProperty(Wallpaper.prototype, 'wallpaperSrc', {
    readonly: true,
    value: ''
  });

  /**
   * Init Wallpaper module.
   *
   * @private
   */
  Wallpaper.prototype._init = function w_init() {
    this.wallpaperURL = new SettingsURL();
    this._watchWallpaperChange();
  };

  /**
   * Watch the value of wallpaper.image from settings and change wallpaperSrc.
   *
   * @private
   */
  Wallpaper.prototype._watchWallpaperChange = function w_watchWallpaper() {
    SettingsListener.observe(WALLPAPER_KEY, '', value => {
      this._wallpaperSrc = this.wallpaperURL.set(value);
    });
  };

  /**
   * Switch to wallpaper or gallery app to pick wallpaper.
   *
   * @param {String} secret
   * @private
   */
  Wallpaper.prototype._triggerActivity = function w_triggerActivity(secret) {
    var mozActivity = new MozActivity({
      name: 'pick',
      data: {
        type: ['wallpaper', 'image/*'],
        includeLocked: (secret !== null),
        // XXX: This will not work with Desktop Fx / Simulator.
        width: Math.ceil(window.screen.width * window.devicePixelRatio),
        height: Math.ceil(window.screen.height * window.devicePixelRatio)
      }
    });
    mozActivity.onsuccess = () => {
      this._onPickSuccess(mozActivity.result.blob, secret);
    };

    mozActivity.onerror = this._onPickError;
  };

  /**
   * Call back when picking success.
   *
   * @param {String} blob
   * @param {String} secret
   * @private
   */
  Wallpaper.prototype._onPickSuccess = function w_onPickSuccess(blob, secret) {
    if (!blob) {
      return;
    }
    if (blob.type.split('/')[1] === ForwardLock.mimeSubtype) {
      // If this is a locked image from the locked content app, unlock it.
      ForwardLock.unlockBlob(secret, blob, unlocked => {
        this._setWallpaper(unlocked);
      });
    } else {
      this._setWallpaper(blob);
    }
  };

  /**
   * Update the value of wallpaper.image from settings.
   *
   * @param {String} value
   * @private
   */
  Wallpaper.prototype._setWallpaper = function w_setWallpaper(value) {
    var config = {};
    config[WALLPAPER_KEY] = value;
    SettingsListener.getSettingsLock().set(config);
  };

  /**
   * Call back when picking fail.
   *
   * @private
   */
  Wallpaper.prototype._onPickError = function w_onPickError() {
    console.warn('pick failed!');
  };

  /**
   * Start to select wallpaper.
   */
  Wallpaper.prototype.selectWallpaper = function w_selectWallpaper() {
    ForwardLock.getKey(this._triggerActivity.bind(this));
  };

  return Wallpaper;
});

/**
 * Manage the column layout of the home screen.
 */
define('panels/homescreens/homescreen_cols',['require','modules/base/module','shared/homescreens/homescreen_settings','modules/mvvm/observable'],function(require) {
  'use strict';

  var Module = require('modules/base/module');
  var HomescreenSettings = require('shared/homescreens/homescreen_settings');
  var Observable = require('modules/mvvm/observable');

  var HomescreenCols = Module.create(function HomescreenCols() {
    this.super(Observable).call(this);

    this._isUpdating = false;
    this._cachedColsValue = null;

    // We may update this value somewhere in other apps.
    HomescreenSettings.addEventListener('updated', e => {
      var prop = e.target;
      if (prop.name === 'grid.cols') {
        this._cols = prop.value;
      }
    });

    // Set the default value.
    HomescreenSettings.get('grid.cols').then(number => {
      this._cols = number;
    });
  }).extend(Observable);

  /**
   * @memberOf HomescreenCols
   * @type {Number}
   * @public
   */
  Observable.defineObservableProperty(HomescreenCols.prototype, 'cols', {
    readonly: true,
    value: null
  });

  /**
   * Change the value of `grid.cols` preference of the homescreen.
   *
   * @param {Number} value
   */
  HomescreenCols.prototype.setCols = function hc_setCols(value) {
    if (!this._isUpdating) {
      this._isUpdating = true;
      HomescreenSettings.put('grid.cols', value).then(() => {
        this._cols = value;
        this._isUpdating = false;
        if (this._cachedColsValue) {
          var cachedValue = this._cachedColsValue;
          this._cachedColsValue = null;
          this.setCols(cachedValue);
        }
      });
    } else {
      this._cachedColsValue = value;
    }
  };

  Object.defineProperty(HomescreenCols.prototype, 'verticalhomeActive', {
    set: function(active) {
      HomescreenSettings.setStoreName(active ?
        'vertical_preferences_store' : 'homescreen_settings');
      HomescreenSettings.get('grid.cols').then(number => {
        this._cols = number;
      });
    },

    enumerable: true
  });

  return HomescreenCols;
});

/**
 * HomescreenName module has a `name` property that contains the name of the
 * currently used home screen and can be watched.
 *
 * @module HomescreenName
 */
define('panels/homescreens/homescreen_name',['require','shared/settings_listener','modules/apps_cache','shared/manifest_helper','modules/base/module','modules/mvvm/observable'],function(require) {
  'use strict';

  const MANIFEST_URL_PREF = 'homescreen.manifestURL';

  var SettingsListener = require('shared/settings_listener');
  var AppsCache = require('modules/apps_cache');
  var ManifestHelper = require('shared/manifest_helper');
  var Module = require('modules/base/module');
  var Observable = require('modules/mvvm/observable');

  var HomescreenName = Module.create(function HomescreenName() {
    this.super(Observable).call(this);
    this._init();
  }).extend(Observable);

  /**
   * Name of the currently installed home screen.
   *
   * @memberOf HomescreenName
   * @type {String}
   * @public
   */
  Observable.defineObservableProperty(HomescreenName.prototype, 'name', {
    readonly: true,
    value: ''
  });

  /**
   * Init HomescreenName module.
   *
   * @private
   */
  HomescreenName.prototype._init = function hn_init() {
    this._watchNameChange();
  };

  /**
   * Watch the value of MANIFEST_URL_PREF from settings and update name
   * accordingly.
   *
   * @private
   */
  HomescreenName.prototype._watchNameChange = function hn_watchNameChange() {
    SettingsListener.observe(MANIFEST_URL_PREF, '', manifestURL => {
      this._updateManifestName(manifestURL).then(name => {
        this._name = name;
      }).catch(e => {
        console.warn('Could not get manifest name.', e);
      });
    });
  };

  /**
   * Initialise the value of name when the module is instantiated.
   */
  HomescreenName.prototype.getName = function hn_getName() {
    const settings = window.navigator.mozSettings;

    var homescreenSetting = settings.createLock().get(MANIFEST_URL_PREF);
    homescreenSetting.onsuccess = () => {
      var manifestURL = homescreenSetting.result[MANIFEST_URL_PREF];
      this._updateManifestName(manifestURL);
    };
  };

  /**
   * Given a manifest URL, returns a promise that resolves to the app name.
   *
   * @param {string} manifestURL
   * @returns {Promise}
   * @private
   */
  HomescreenName.prototype._updateManifestName = function hn_umn(manifestURL) {
    return new Promise((resolve, reject) => {
      AppsCache.apps().then(apps => {
        var manifest = null;
        apps.some(app => {
          if (app.manifestURL === manifestURL) {
            manifest = new ManifestHelper(app.manifest || app.updateManifest);
            return true;
          }
        });

        if (!manifest) {
          return reject(new Error('Manifest URL not found'));
        }

        resolve(manifest.name);
      });
    });
  };

  return HomescreenName;
});

/**
 * Manage wallpaper and replaceable home screens.
 */
define('panels/homescreens/panel',['require','shared/settings_listener','modules/settings_panel','panels/homescreens/wallpaper','panels/homescreens/homescreen_cols','panels/homescreens/homescreen_name'],function(require) {
  'use strict';

  const VERTICALHOME_MANIFEST =
    'app://verticalhome.gaiamobile.org/manifest.webapp';

  var SettingsListener = require('shared/settings_listener');
  var SettingsPanel = require('modules/settings_panel');
  var Wallpaper = require('panels/homescreens/wallpaper');
  var HomescreenCols = require('panels/homescreens/homescreen_cols');
  var HomescreenName = require('panels/homescreens/homescreen_name');

  var elements = {};
  var gridSelect = null;

  return function ctor_homescreen_panel() {
    var wallpaper = Wallpaper();
    var homescreenCols = HomescreenCols();
    var homescreenName = HomescreenName();

    return SettingsPanel({
      /**
       * @param {HTMLElement} panel The panel HTML element.
       */
      onInit: function hp_onInit(panel) {
        elements = {
          wallpaper: panel.querySelector('.wallpaper'),
          wallpaperPreview: panel.querySelector('.wallpaper-preview'),
          currentHomescreen: panel.querySelector('.current-homescreen')
        };

        elements.wallpaper.addEventListener('click',
          wallpaper.selectWallpaper.bind(wallpaper));

        SettingsListener.observe('homescreen.manifestURL', '', manifestURL => {
          homescreenCols.verticalhomeActive =
            manifestURL === VERTICALHOME_MANIFEST;
        });

        gridSelect = panel.querySelector('[name="grid.layout.cols"]');
        gridSelect.addEventListener('change', function() {
          homescreenCols.setCols(this.value);
        });
      },

      onBeforeShow: function hp_onBeforeShow(panel, options) {
        this._setWallpaperPreviewSrc(wallpaper.wallpaperSrc);
        this._setHomescreenName(homescreenName.name);
        this._updateCols(homescreenCols.cols);

        homescreenCols.observe('cols', this._updateCols);

        wallpaper.observe('wallpaperSrc', this._setWallpaperPreviewSrc);
        homescreenName.observe('name', this._setHomescreenName);
      },

      onBeforeHide: function hp_onBeforeHide() {
        wallpaper.unobserve('wallpaperSrc');
        homescreenName.unobserve('name');
        homescreenCols.unobserve('cols');
      },

      /**
       * @param {String} src
       * @private
       */
      _setWallpaperPreviewSrc: function hp_setHomescreenName(src) {
        elements.wallpaperPreview.src = src;
      },

      /**
       * @param {Number} number The number of columns in the layout.
       * @private
       */
      _updateCols: function hdp_updateCols(number) {
        if (!number) {
          return;
        }

        var option =
          gridSelect.querySelector('[value="' + number + '"]');

        if (option) {
          option.selected = true;
        }
      },

      /**
       * @param {String} name
       * @private
       */
      _setHomescreenName: function hp_setHomescreenName(name) {
        elements.currentHomescreen.textContent = name;
      }
    });
  };
});

