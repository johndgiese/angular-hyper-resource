
(function(angular) {
  'use strict';
  
  var module = angular.module('hyperResource', ['ngResource']);

  var resourceTypeResolver = resourceTypeFromLinkType;

  // list of previously generated resources, used when instantiating
  // objects from HAL links or embedded resources
  var resources = {};

  var HyperObject = function(value) {
    angular.extend(this, value || {});
  };

  module.provider('hResource', function HalResourceProvider() {

    this.setResourceTypeResolver = function(resolver) {
      resourceTypeResolver = resolver;
    };

    this.$get = ['$resource', '$q', '$http', function($resource, $q, $http) {


      HyperObject.prototype = {
        $rel: getRelatedResource,
        $if: getRelatedResourceCount
      };

      function hResourceFactory(resourceName, url, paramDefaults, actions) {

        var registeringType = angular.isString(url);

        if (!registeringType) {
          actions = paramDefaults;
          paramDefaults = url;
          url = resourceName;
        }

        var Resource = $resource(url, paramDefaults, actions);

        if (registeringType) {
          resources[resourceName] = Resource;
        }

        angular.extend(Resource.prototype, HyperObject.prototype);
        return Resource;
      }

      return hResourceFactory;


      function getRelatedResource(relation, name) {
        if (this.$resolved === false) {
          throw "Can't count related resources until the resource has resolved";
        }
        var links = resolveLinks(this, relation, name);
        var embeddeds = resolveEmbedded(this, relation, name);
        var matches = links.length + embeddeds.length;

        if (matches == 0) {
          return $q.reject("No resource matches provided `relation` and `name` pair");
        }

        if (matches == 1) {
          if (links.length > 0) {
            return getLinkResource(links[0]);
          } else {
            return getEmbeddedResource(embeddeds[0]);
          }
        }

        var relatedResources = [];
        angular.forEach(embeddeds, function(embedded) {
          relatedResources.push(getEmbeddedResource(embedded));
        });
        angular.forEach(links, function(link) {
          relatedResources.push(getLinkResource(link));
        });

        return $q.all(relatedResources);
      }

      function getRelatedResourceCount(relation, name) {
        if (this.$resolved === false) {
          throw "Can't count related resources until the resource has resolved";
        }
        var links = resolveLinks(this, relation, name);
        var embeddeds = resolveEmbedded(this, relation, name);
        return links.length + embeddeds.length;
      }


      function resolveResource(linkOrEmbedded) {
        var resourceType = resourceTypeResolver(linkOrEmbedded);
        if (resourceType && resources[resourceType]) {
          return resources[resourceType];
        } else {
          return HyperObject;
        }
      }

      function resolveLinks(object, relation, name) {
        var matches = resolveRelatedResource(object._links, relation);
        if (name) {
          matches = matches.filter(function(item) {
            return item.name && item.name === name;
          });
        }
        return matches;
      }

      function resolveEmbedded(object, relation, name) {
        var matches = resolveRelatedResource(object._embedded, relation);
        if (name) {
          matches = matches.filter(function(item) {
            return item._links && item._links.self && item._links.self.name === name;
          });
        }
        return matches;
      }

      function resolveRelatedResource(resources, relation) {
        if (resources && resources[relation]) {
          var matches = resources[relation];
          if (!angular.isArray(matches)) {
            matches = [matches];
          }
          return matches;
        } else {
          return [];
        }
      }

      function getLinkResource(link) {
        var href = link.href;
        var Resource = resolveResource(link);
        return $http.get(href).success(function(data) {
          return new Resource(data);
        });
      }

      function getEmbeddedResource(embedded) {
        var Resource = resolveResource(embedded);
        return $q.when(new Resource(embedded));
      }

    }];

  });


  // default resource type resolver
  function resourceTypeFromLinkType(linkOrEmbedded) {
    var isEmbedded = linkOrEmbedded._links && linkOrEmbedded._links.self;
    if (isEmbedded) {
      var link = linkOrEmbedded._links.self;
    } else {
      var link = linkOrEmbedded;
    }
    return link.type;
  }

  
})(angular);
