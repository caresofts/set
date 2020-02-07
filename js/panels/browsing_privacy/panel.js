define('panels/browsing_privacy/browsing_privacy',['require'],function(require) {
  'use strict';

  function BrowsingPrivacy() {}

  /**
   * Clear browser history.
   */
  BrowsingPrivacy.prototype.clearHistory = function() {
    navigator.mozSettings.createLock().set({'clear.browser.history': true});
  };

  /**
   * Clear browser private data.
   */
  BrowsingPrivacy.prototype.clearPrivateData = function() {
    navigator.mozSettings.createLock().set({
      'clear.browser.private-data': true
    });
  };

  return function() {
    return new BrowsingPrivacy();
  };
});

define('panels/browsing_privacy/panel',['require','modules/settings_panel','panels/browsing_privacy/browsing_privacy','modules/dialog_service'],function(require) {
  'use strict';

  var SettingsPanel = require('modules/settings_panel');
  var BrowsingPrivacy = require('panels/browsing_privacy/browsing_privacy');
  var DialogService = require('modules/dialog_service');

  var browsingPrivacy = BrowsingPrivacy();
  var clearHistoryButton, clearPrivateDataButton;

  function onInit(panel) {
    clearHistoryButton = panel.querySelector('.clear-history-button');
    clearPrivateDataButton = panel.querySelector('.clear-private-data-button');

    clearHistoryButton.addEventListener('click',
      handleClearHistoryClick);
    clearPrivateDataButton.addEventListener('click',
      handleClearPrivateDataClick);
  }

  /**
   * Handle clear history button click.
   */
  function handleClearHistoryClick() {
    DialogService.confirm('confirm-clear-history-desc', {
      title: 'confirm-clear-history-title',
      submitButton: { id: 'clear', style: 'danger' },
      cancelButton: 'cancel'
    }).then((result) => {
      if (result.type === 'submit') {
        return browsingPrivacy.clearHistory();
      }
    });
  }

  /**
   * Handle clear private data button click.
   */
  function handleClearPrivateDataClick() {
    DialogService.confirm('confirm-clear-cookies-cache-desc', {
      title: 'confirm-clear-cookies-cache-title',
      submitButton: { id: 'delete', style: 'danger' },
      cancelButton: 'cancel'
    }).then((result) => {
      if (result.type === 'submit') {
        return browsingPrivacy.clearPrivateData();
      }
    });
  }

  function onUninit() {
    clearHistoryButton.removeEventListener('click',
      handleClearHistoryClick);
    clearPrivateDataButton.removeEventListener('click',
      handleClearPrivateDataClick);
  }

  return function() {
    return SettingsPanel({
      onInit: onInit,
      onUninit: onUninit
    });
  };
});

