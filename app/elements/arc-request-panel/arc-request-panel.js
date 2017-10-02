Polymer({
  is: 'arc-request-panel',

  properties: {
    /**
     * Current route params.
     */
    routeParams: Object,
    /**
     * Set by parent element to determine that this view is opened.
     */
    opened: Boolean,
    /**
     * Set by the `chrome-xhr-request` element. True if the proxy extension
     * is installed an connected to the application.
     */
    hasProxyInstalled: Boolean,
    /**
     * Current request object.
     */
    request: Object,
    /**
     * Keeps temp request data restored from the datastore / local store
     * to sync state between different stores and the UI.
     */
    proxyRequest: Object,
    /**
     * If set the panel will use the XHR proxy to send the request
     */
    useXhr: Boolean,
    // Currently selected project.
    projectId: String
  },

  listeners: {
    'transport-request': '_onTransportRequested',
    'abort-request': '_abortHandler'
  },

  observers: [
    '_routeChnaged(routeParams, opened)',
    '_openedChanged(opened)',
    '_proxyRequestChanged(proxyRequest.*)',
    '_requestChanged(request.*)',
    '_projectIdChanged(projectId)'
  ],

  _routeChnaged: function(route, opened) {
    if (!opened || !route || !route.type) {
      return;
    }
    switch (route.type) {
      case 'saved':
      case 'history':
        let id = decodeURIComponent(this.routeParams.savedId || this.routeParams.historyId);
        this._restoreRequestData(id, route.type);
        break;
      case 'current':
      case 'drive':
        return;
      default:
        this.restoreLatest();
        break;
    }
  },

  _openedChanged: function(opened) {
    if (opened) {
      this._requestFeatures();
    } else {
      this._releaseFeatures();
    }
  },

  _requestFeatures: function() {
    this.fire('request-toolbar-features', {
      features: ['clearAll', 'save', 'xhrtoggle']
    }, {
      cancelable: true
    });
  },

  _releaseFeatures: function() {
    this.fire('release-toolbar-features', {}, {
      cancelable: true
    });
  },

  _onTransportRequested: function(e) {
    this.fire('url-history-store', {
      value: this.request.url
    }, {
      cancelable: true,
      composed: true
    });
    var panel;
    if (this.useXhr) {
      panel = this.$$('chrome-xhr-request');
    } else {
      panel = this.$$('chrome-socket-request');
    }
    panel.send(e.detail)
    .catch(cause => {
      console.error(cause);
    });
  },
  /**
   * Aborts the request.
   */
  _abortHandler: function() {
    var panel;
    if (this.useXhr) {
      panel = this.$$('chrome-xhr-request');
    } else {
      panel = this.$$('chrome-socket-request');
    }
    panel.abort();
    this.fire('url-history-store', {
      value: this.request.url
    }, {
      cancelable: true,
      composed: true
    });
  },
  /**
   * Handler for the XHR change event
   */
  _xhrChanged: function(e) {
    var requested = e.detail.value;
    e.preventDefault();
    e.stopPropagation();

    if (!this.hasProxyInstalled && requested) {
      this.$$('install-proxy-dialog').opened = true;
      return;
    }
    this.useXhr = requested;
    this.fire('send-analytics', {
      type: 'event',
      category: 'Request',
      action: 'Use XHR',
      label: requested + '',
    });
  },
  /**
   * Clears the request state
   */
  clearRequest: function(e) {
    this.set('request', {
      method: 'GET'
    });
    this.projectId = undefined;
    if (e && e.preventDefault) {
      e.preventDefault();
      e.stopPropagation();
    }
  },
  /**
   * Restores saved in the datastore request data.
   * @param {String} id ID of the record
   * @param {String} type Type of the stored data. Can be `saved`, `history` or
   * `drive`
   */
  _restoreRequestData: function(id, type) {
    type = type || 'saved';
    var dbName;
    switch (type) {
      case 'saved':
        dbName = 'saved-requests';
        break;
      case 'history':
        dbName = 'history-requests';
        break;
      case 'drive':
        dbName = 'saved-requests';
        break;
      default:
        this.fire('app-log', {
          'message': `${type} is not a type of a request.`,
          'level': 'error'
        });
        console.error('Can\'t restore request data. Type is unknown.', type);
        this.fire('send-analytics', {
          type: 'exception',
          description: 'Can\'t restore request of a type: ' + type + ' (ArcRequestPanel)',
          fatal: true
        });
        this.$.typeMissingToast.opened = true;
        return;
    }

    var db = new PouchDB(dbName);
    return db.get(id)
    .then((r) => {
      r.type = type;
      this.set('proxyRequest', r);
    })
    .catch((e) => {
      this.fire('app-log', {
        'message': e,
        'level': 'error'
      });
      console.error('Can\'t restore request data', e);
      this.$.missingRequestToast.opened = true;
    });
  },
  /**
   * Sets the `request` object when a proxy change.
   */
  _proxyRequestChanged: function(record) {
    if (!record || !record.base) {
      return;
    }
    var data = record.base;
    var base = {
      _id: data._id,
      type: data.type,
      headers: data.headers,
      legacyProject: data.legacyProject,
      method: data.method,
      name: data.name,
      payload: data.payload,
      url: data.url,
      description: data.description
    };
    if (data.legacyProject !== this.projectId) {
      this.set('projectId', data.legacyProject);
    }
    this.set('request', base);
  },
  // Restores latest request from local storage.
  restoreLatest: function() {
    this.$.latest.read();
  },

  // Handler for latest rectore call.
  _latestLoaded: function(e) {
    var obj = e.detail.value;
    if (!obj) {
      obj = {
        method: 'GET'
      };
    }
    this.set('request', obj);
  },

  _requestChanged: function(record) {
    if (!record || !record.base) {
      return;
    }
    var request = record.base;
    if (Object.keys(request).length === 1 && request.method && request.method === 'GET') {
      // Default value.
      return;
    }
    this.debounce('request-store', function() {
      this.$.latest.store();
    }, 100);
  },
  /**
   * Handler for the save event from the request editor.
   */
  _saveHandler: function(e) {
    this.onSave({});
    e.preventDefault();
    e.stopPropagation();
  },

  onSave: function(opts) {
    if (!this.request.url || !this.request.url.trim()) {
      return;
    }
    var type = this.request.type;
    var isDrive;
    var isSaved;
    if (type) {
      isDrive = type === 'google-drive';
      isSaved = type === 'saved';
    } else {
      isDrive = !!this.routeParams.externalId;
      isSaved = !!this.routeParams.savedId;
    }
    if ((isDrive || isSaved) && opts.source === 'shortcut' && !opts.shift) {
      return this._saveCurrent();
    }

    this.$.requestEditor.request = this.request;
    this.$.requestEditorContainer.opened = true;
    this.fire('send-analytics', {
      'type': 'event',
      'category': 'Engagement',
      'action': 'Click',
      'label': 'Save action initialization'
    });
  },

  _resizeEditorSheetContent: function() {
    this.$.requestEditor.notifyResize();
  },

  _cancelRequestEdit: function() {
    this.$.requestEditorContainer.opened = false;
    this.$.requestEditor.request = undefined;
  },

  _saveCurrent: function() {
    var data = Object.assign({}, this.proxyRequest, this.request);
    var opts = {
      isDrive: this.request.type === 'google-drive',
      projectId: this.projectId,
      name: data.name,
      description: data.description
    };

    this._dispatchSaveRequest(opts, data);
    this.fire('send-analytics', {
      'type': 'event',
      'category': 'Engagement',
      'action': 'Click',
      'label': 'Save express'
    });
  },

  /**
   * Prepares a detail object for the `save-request-data` event.
   *
   * @param {Object} opts Map of saving request options returned from save
   *                      panel / dialog
   * @param {Object} request The request object to update.
   * @return {Object} Event's detail object.
   */
  _prepareSaveRequestEvent: function(opts, request) {
    var data = Object.assign({}, request);
    if (opts.name) {
      data.name = opts.name;
    }
    if (opts.description) {
      data.description = opts.description;
    } else if (data.description) {
      delete data.description;
    }
    if (opts.override === false || opts.type === 'history') {
      delete data._id;
      delete data._rev;
    }
    var detail = {
      request: data,
      opts: opts
    };
    detail.opts.drive = opts.isDrive ? true : false;
    delete opts.isDrive;
    return detail;
  },

  /**
   * Dispatches the event to save request data in the data store.
   * @param {CustomEvent} e The `save-request` event dispatched from the editor.
   */
  _saveRequestEdit: function(e) {
    this.$.requestEditorContainer.opened = false;
    this.$.requestEditor.request = undefined;
    this._dispatchSaveRequest(e.detail, e.detail.request);
  },

  _dispatchSaveRequest: function(opts, data) {
    var detail = this._prepareSaveRequestEvent(opts, data);

    var event = this.fire('save-request-data', detail, {
      cancelable: true,
      composed: true
    });

    if (!event.defaultPrevented) {
      let message = 'Unable to save current request.\n';
      message += 'The "save-request-data" event is not handled.';
      console.error(message);
      this.fire('app-log', {
        'message': [message],
        'level': 'error'
      });
      this.$.errorToast.text = message;
      this.$.errorToast.opened = true;
      return Promise.reject(new Error('Save event not handled'));
    }

    // if (opts.isProject) {
    //   if (opts.projectIsNew) {
    //     detail.opts.projectName = opts.projectName;
    //   } else {
    //     detail.opts.projectId = opts.projectId;
    //   }
    // }

    return event.detail.result
    .then(request => {
      this.$.savedOk.opened = true;
      if (request.legacyProject && request.legacyProject !== this.projectId) {
        this.set('projectId', request.legacyProject);
      } else if (!request.legacyProject && this.projectId) {
        this.set('projectId', undefined);
      }
      this.proxyRequest = data;
      var id = request._id;
      try {
        id = encodeURIComponent(id);
      } catch (e) {}
      this.set('routeParams', {
        savedId: id,
        type: 'saved'
      });
    })
    .catch(cause => {
      console.error('Save request error', cause);
      this.fire('app-log', {
        'message': ['Unable to save the request.', cause],
        'level': 'error'
      });
      this.$.errorToast.text = 'Unable to save current request. ' + cause.message;
      this.$.errorToast.opened = true;
    });
  },
  /**
   * Inform other elements that the project ID changed.
   */
  _projectIdChanged: function(id) {
    this.fire('selected-project-changed', {
      value: id
    });
  }
});