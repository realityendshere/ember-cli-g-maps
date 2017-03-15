import Ember from 'ember';

const {
  get,
  typeOf,
  computed
} = Ember;

let mapIter = 0;

export default Ember.Service.extend({
  maps: (function() {

    /**
     * Store or Gmaps.maps
     * @type {Ember Array}
     */
    const maps = Ember.A([]);

    return {

      /**
       * Return map instance from store by name
       * @param {String} name [Name of Google Map instance]
       * @return {Object} found [GMap.maps store item]
       */
      select(name) {
        let found;

        for(let i = 0, l = maps.length; i < l; i++) {
          if(maps[i].name === name){
            found = maps[i];
            return found;
          }
        }

        return found;
      },

      /**
       * Add new map instance to store by name
       * @param {String} name [Name of Google Map instance]
       * @param {Object} mapItem [GMap.maps store item]
       */
      add(name, map) {
        if(typeof name !== 'string') {
          throw new Error('GMap name must be a string');
        }

        if (map instanceof google.maps.Map === false) {
          throw new Error('GMap service only accepts Google Map instances');
        }

        if(this.select(name)) {
          throw new Error('GMap name is taken, select a new GMap name');
        }

        const mapItem = { name, map };

        // Using accessor property to avoid calling warning via `service.add`
        Object.defineProperty(mapItem, 'onLoad', {
          get() {
            return new Ember.RSVP.Promise((resolve) => {
              google.maps.event.addListenerOnce(map, 'idle', () => {
                Ember.Logger.warn('gMaps service onLoad has been deprecated, please use the component\'s `loaded` action instead.');
                resolve();
              });
            });
          }
        });

        maps.pushObject(mapItem);

        return mapItem;
      },

      /**
       * Remove map instance from store by name
       * @param {String} name [Name of Google Map instance]
       * @return {Boolean} isSuccessful [Successfully removed]
       */
      remove(name) {
        let isSuccessful = false;

        for(let i = 0, l = maps.length; i < l; i++) {
          if(maps[i].name === name){
            maps.removeAt(i);
            isSuccessful = true;
            return isSuccessful;
          }
        }

        return isSuccessful;
      },

      /**
       * Refresh a Google Map instance
       * @param {String} name [Name of Google Map instance]
       * @return {Boolean} isSuccessful [Successfully refreshed]
       */
      refresh(name) {
        let isSuccessful = false;
        const mapStore = this.select(name);

        if (!mapStore) {
          Ember.Logger.warn(`Attempted to refresh undefined GMap instance: ${name || '(no map name given)'}`);
        } else {
          google.maps.event.trigger(mapStore.map, 'resize');
          isSuccessful = true;
        }

        return isSuccessful;
      },

      list() {
        return maps.mapBy('name');
      }
    };
  })(),

  /**
   * @type {Array}
   * Store references to all active geocode request promises
   */
  _geocodeQueue: [],

  geocode(options) {
    const queue = this._geocodeQueue;

    const request = new Ember.RSVP.Promise(function(resolve, reject) {
      options.callback = function(result, status) {
        if (status === 'OK' || status === 'ZERO_RESULTS') {
          resolve(result);
        } else {
          const err = { status };

          // Add any available error_message
          if(result && result.error_message) {
            err.message = result.error_message;
          }

          reject(err);
        }

        queue.splice(queue.indexOf(request), 1); // remove from queue
      };

      GMaps.prototype.geocode(options);
    });

    queue.push(request); // add to queue

    return request;
  },

  autocompletes: computed({
    get() {
      let autocompletes = {};
      return {
        add(item) {
          let id = get(item.component, 'elementId');
          autocompletes[id] = item;
        },
        remove(component) {
          let id = get(component, 'elementId');
          delete autocompletes[id];
        },
        get(component) {
          if (typeOf(component) === 'string') {
            return autocompletes[component];
          }
          let id = get(component, 'elementId');
          return autocompletes[id];
        }
      };
    }
  }),

  googleAPI: computed({
    get() {
    }
  }),

  /**
   @public

   Add a new map instance to store by name. Map names must be unique.

   Example:

   ```
   import Ember from 'ember';

    export default Ember.Component.extend({
      gMap: Ember.inject.service(),

      addMapWithName(name) {
        var map = new google.maps.Map();

        this.get('gMap').addMap(name, map); // {name: 'main-map', map: (Map instance)}
      },

      addMapWithoutName() {
        var map = new google.maps.Map();

        this.get('gMap').addMap(map); // {name: 'map-1', map: (Map instance)}
      }
    });
   ```

   @method addMap
   @param {String} name
   @param {Object} mapItem [GMap.maps store item]
   @return {Object} A "plain" object with a name and the map instance
  */
  addMap(name, map) {
    mapIter++;

    if (name instanceof google.maps.Map === true) {
      map = name;
      name = `map-${mapIter.toString(36)}`;
    }

    return this.maps.add(name, map);
  },

  /**
   @public

   List the names of maps managed by the service.

   @method list
   @return {Array} A "plain" object with a name and the map instance
  */
  list() {
    return this.maps.list();
  },

  /**
   @public

   Refresh a Google Map instance by name.

   @method refreshMap
   @param {String} name
   @return {Boolean} True is success. False if refresh failed.
  */
  refreshMap(name = '') {
    return this.maps.refresh(name);
  },

  /**
   @public

   Remove all registered maps from the service. Mostly used for unit testing.

   @method removeAll
   @return {Boolean} True is success. False if any removal failed.
  */
  removeAll() {
    let list = this.list();

    for (var i = list.length - 1; i >= 0; i--) {
      this.removeMap(list[i]);
    }

    list = this.list();
    mapIter = list.length;

    return (list.length === 0) ? true : false;
  },

  /**
   @public

   Remove a registerd Google Map instance by name.

   @method removeMap
   @param {String} name
   @return {Boolean} True is success. False if removal failed.
  */
  removeMap(name = '') {
    return this.maps.remove(name);
  },

  /**
   @public

   Find a Google Map instance by name.

   @method selectMap
   @param {String} name
   @return {Object|Null} found [GMap.maps store item] or null
  */
  selectMap(name = '') {
    var result = this.maps.select(name);

    if (result && result.map) {
      return result.map;
    }

    return null;
  }
});
