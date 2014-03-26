# Angular Hyper Resource

Hyper Resource is an [angularjs](http://angularjs.org) module that extends angular's
native `$resource` service to work well with Hypermedia APIs using [HAL](http://stateless.co/hal_specification.html).

## HATEOAS and Linking within an API

Single page applications usually require an API to persist data.

One of the tenants of RESTful APIs is [HATEOAS](http://en.wikipedia.org/wiki/HATEOAS), or 
Hypermedia as the Engine of Application State.  The word sounds complicated but
stated simply, HATEOAS says your API should be like a state-machine, and state-transitions
should occur by following some sort of "hyperlink".  If you think about it,
this is how the web works: we go to a page (a resource, or state) and we move
to other pages by clicking links (state transitions).

Very few APIs fully follow HATEOAS, and there is quite a bit of debate online
as to how important it is.  I think one of the reasons many APIs don't follow
it, is simply because unlike humans browsing the web, who follow links as
their curiosity directs, machines are usually interacting with a resource for a
known purpose.  Thus the idea that a machine will `discover` an API purely
through links doesn't seem to work well in practice.  That said, there
are some serious benefits to following HATEOAS when it makes sense.

In the context of an API, this means a resource should have links to other
resources.  How is a link represented in an API?  Well, there are many ways you
could do it, but some smart people have spent a lot of time thinking about it
and have developed [good standards](http://tools.ietf.org/html/rfc5988) about web
linking.  If you follow this standard, you are in good company, because it is also used in

* the HTML `<link>` tag
* the HTTP link header
* ATOM

Even after understanding link relation types, there are many ways of
representing these relationships within a JSON API.  There are no set standards
for this yet, however [Hypertext Application Language](http://stateless.co/hal_specification.html) 
(or HAL for short) is widely used.


## Hypertext Application Language (HAL)

HAL is a simple extension of JSON that provides a standard way of encoding
related resources in APIs.  A HAL resource may have a `_links` object which
contains links to related resources.  The `_links` object's keys are the relation types 
(see the official [IANA registry](http://www.iana.org/assignments/link-relations/link-relations.xhtml) if you are curious, but we don't believe in being so anal as to follow it exactly---even the HAL spec doesn't) and
the values are either an object (if there is one resource with this relation)
or an array (if there are more than one resources with this relation).  Each
link must contain an `href` property which is the URL representing the related
resource.  There are also some optional properties, including a `name` and `type`.

Here is an example:

````json
{
    "name": "John David Giese",
    "_links": {
        "self": {
            "href": "/persons/4234"
        },
        "father": {
            "href": "/persons/2332"
        },
        "brothers": [
            {
                "href": "/persons/2242",
            },
            {
                "href": "/persons/2549",
            },
            {
                "href": "/persons/2600",
            }
        ]
    }
}
````

When interacting with RESTful APIs, it is often useful to embedd multiple
resources in a single request so that we can avoid multiple round trips to the
server.  For example, imagine we have a `book` resource with chapters.
Whenever we retrieve the `book` resource we will nearly always want to look at
the current chapter.  HAL has a second reserverd keyword, `_embedded`, for this
purpose.  It works nearly identically to links.


````json
{
    "title": "Javascript: The Good Parts",
    "author": "Douglas Crockford",
    "_links": {
        "self": {
            "href": "/books/342"
        }
    },
    "_embedded": {
        "current": {
            "title": "Inheritance",
            "_links": {
                "self": {
                    "href": "/books/342/chapters/5",
                    "type": "chapter"
                },
                "next": {
                    "href": "/books/342/chapters/6",
                    "type": "chapter"
                },
                "prev": {
                    "href": "/books/342/chapters/4",
                    "type": "chapter"
                }
            }
        }
    }
}
````

As you can see, embedded resources can have links (and even further embedded resources).

So that is HAL!  Quite simple really.  I should also mention that you can use the special mime type, "application/hal+json", if you want to be cool.

## AngularJs and HAL

Angular provides the `$resource` service (as part of the optional `ngResource` module)
to help simplify API interactions.  Without something like the `$resource`
service, one needs to construct the API's URLs and making requests with the
`$http` service directly.  This can quickly get tedious.  By using the
`$resource` service, one can define the URLs for interacting with their data
resources, as well as which http methods are supported, and from then on they
can use the resource at a higher level of abstraction.

Take a look at the [documentation for $resource](http://docs.angularjs.org/api/ngResource/service/$resource)
for more details and some examples.

When interacting with an API that uses HAL, we want all of ngResource's functionality, but
it would also be nice if the service provided convenience methods for
interacting with related resources.  This is where the `hyperResource` module
comes in.  It provides a single service, `hResource`, that is a small and
somewhat opinionated extension of the `$resource` service.

## API Constraints

This "opinionated" approach to HAL places a few extra constraints on the API.

Because the hResource service attempts to abstract away the distinction between a
`_linked` and `_embedded` resource, the API must always return one or the other (and not both, otherwise both will be returned).

Following this makes the angular app simplier, because it doesn't have to worry about which is which when resolving a related resource.  Instead, the app is returned a promise for the resource, and the distinction between a linked vs. embedded resource only determines how quickly that promise will be fulfilled.  If is a link, it will be a
fulfilled after another round trip to the API, otherwise it will be fulfilled immediately.  

This abstraction allows the API to worry about performance and caching issues, while freeing the client to work
with the resources.

From now on, a "related resource" can be either linked or embedded, as the
distinction is irrelevant.

## Basic Use

We now know enough background to dive into the basics.

The `hResource` service can be called identically to how the `$resource`
service is called, and like the `$resource` service it returns a constructor
function for interacting with APIs.  We reccomend creating services for each of your
resources (don't forget to [capitalize them](http://stackoverflow.com/questions/1564398/javascript-method-naming-lowercase-vs-uppercase)
because they are constructor functions!).  For example:

````js
angular.module('app', ['hyperResource'])
.service('Book', ['hResource', function(hResource) {
    return hResource('/books/:bookId', {bookId: '@id'});
});
````

We can now use our `Book` service to retrieve books from the server like we would with `$resource`.  
The following code could go anywhere where the `Book` service is injected.

````js
var jsBooks = Book.query({includes: 'javascript'});
var linearAlgebra = Book.get({title: 'Linear Algebra', author: 'Strang'});
````

hResource instances are provided all of the `$resource` methods (e.g. `$save`),
in addition to two convenience methods specifically for interacting with
related resources.  

### The `$rel` resource instance method

The first resource instance method, `$rel`, provides a simple interface for
grabbing related resources.  It takes a single required argument that specifies
the relationship (i.e. the [rel attribute]
(https://developer.mozilla.org/en-US/docs/Web/HTML/Link_types) in
HTML links), and a second optional argument for relationship name.

The `$rel` method returns a promise for the related resouces.  

- If there is a single match, the promise will resolve to a "hyper-object"---an
  object containing all of the data returned from the API plus the two extra
  `$rel` and `$if` methods.  
- If there are multiple matches, the promise resolves to an array of hyper
  objects.  
- If it can't find the resource, the promise is rejected.  

This is best demonstrated with an example:

````js
var City = hResource('/cities/:id');
var cityData = {
    name: 'Boston',
    _links: {
        self: { href: '/cities/5' },
        state: { href: '/states/7' },
    },
    _embedded: {
        country: { name: 'United States of America' }
    }
};
$httpBackend.expectGET('/city/5').respond(200, cityData);
var boston = City.get({name: 'Boston'});
$httpBackend.flush();

var stateData = { name: 'Massachusets' };

$httpBackend.expectGET('/states/7').respond(200, stateData);
var state = boston.$rel('state')
.then(function(){
    expect(state.name).toBe('Massachusets');
});

var country = boston.$rel('country')
.then(function(){ 
    expect(country.name).toBe('United States of America');
});
````

Again, notice that there is not distinction between embedded and linked resources!

### The `$if` resource instance method

Hyper objects also get an `$if` method.  It takes the same arguments as the `$rel` method, except
instead of returning a promise to those resources, it simply returns the number of matching resources.  
This is useful if you are conditionally displaying items in your view.

````js
// continueing the example from above

expect(book.$if('state')).toBe(1);
expect(book.$if('mayor')).toBe(0);
````

## Advanced Use and Active Records

The above useage pattern is great for many basic situations, however astute readers may have noticed
that the related resources returned by `$rel` are no longer $resource instances!

````js
var Chapter = hResource('/chapters/:id');
var chapterData = {
  title: 'Inheritance',
  _links: {
      first: { href: '/books/1/chapters/1' },
      last: { href: '/books/1/chapters/10', title: 'Beautiful Features' },
  },
  _embedded: {
    next: { title: 'Arrays' }
    prev: { title: 'Functions' }
  }
};

var chapterFour = new Chapter(chapterData);
// could also have used Chapter.get

expect(chapterFour instanceof Chapter).toBe(true);

var chapterFive = chapterFour.$rel('next');

expect(chapterFive instanceof Chapter).toBe(false);

// because how could it know what type it should be?
````

Again, this is probably fine for many situations, however it is often nice to attach
[functionality along with our resouce data](http://en.wikipedia.org/wiki/Active_record_pattern), and when using the
`$resource` service this is done by extending the resource's prototype
function.  If related resources don't preserve the initial type, our instances
won't be able to access our added functionality.

````js
// here is how you would extend a person resource
var Person = hResource('/persons/:id');
Person.prototype.fullName = function() {
    return this.firstName + this.lastName;
};

var person = Person.get({firstName: 'David'});

var myName = person.$promise.then(function(me) {
    // this would work as expected
    return me.fullName();
});

var momsName = person.$rel('mother').then(function(mom) {
    // this would NOT work (yet!)
    return mom.fullName();
});
````

Fortuneatly, `hResource` provides a mechanism for resolve related resource's
types.

### Resolving related resource types

There are two steps involved with preserving resource types.

1. the hResource service must be able to keep track of all types
2. the hResource service must be able to resolve the type of a relatd resource
   from the HAL link

Both steps are pretty trivial.

The first step involves providing an extra `typeName` when creating your
resource.  For example:

````js
var userTypeName = 'user';
var User = hResource(userTypeName, '/users/:id');
````

The second step is a bit more complicated.  Essentially, everytime the `$rel` method is called, 
it has a method called `resolveResourceType` which is passed in the link of the related resouce.  This will be the `_self` link for an embedded resource.

By default, the `hResource` service uses the optional `type` attribute of the
link.  So if we go back to the chapter example we would need to have:

````js
var chapterData = {
  title: 'Inheritance',
  _links: {
      first: { href: '/books/1/chapters/1', type: 'chapter' },
      last: { 
          href: '/books/1/chapters/10',
          title: 'Beautiful Features',
          type: 'chapter' 
      },
  },
  _embedded: {
    next: { 
        _links: { self: {type: 'chapter' }},
        title: 'Arrays'
    }
    prev: {
        _links: { self: {type: 'chapter' }},
        title: 'Functions', type: 'chapter' 
    }
  }
};
````

If the hResource service is unable to resolve the type (or if the type it
resolves to is not registered), it will simply revert to the basic behavior
defined previously.

### Custom resource type resolver

There are many other possibly approachs for resolving a resource's type.

- Resolved from the URL
- Default to the same type as the parent
- From an href template scheme

For this reason, the `hyperResource` app provides the ability to override the default behavior with the `hResourceProvider`.

The hResourceProvider has a single function, `setResourceTypeResolver`, that takes a custom typeResolver.

This function that takes a link or embedded resource and returns a string
matching the appropriate hResource's `resourceName` (the first argument passed
in when constructing an hResource).  All typeResolver functions should return
`undefined` if they can not resolve a type.  If the resolved type is undefined,
or does not match any declared `resourceType`s, then the Object type is used
instead.

## Questions

__How does `hResource` deal with $resource's approach of returning empty arrays and objects?__

The short answer is: Although the `$rel` and `$if` methods exist on the
unresolved resources, calling them before they resolve will throw an error.

If this answer didn't make sense, continue reading:

A subtle but key aspect of the $resource service, is
that resources returned from queries are not promises, but rather are empty
objects or arrays that are filled in with data when the underlying promise is fullfilled.

For example:

````js
var User = $resource('/users/:id');

var user = User.get({id: 1});  

// user is NOT a promise, but is a nearly empty object that will "fill" up with
// data once the underlying promise for the resource is fullfilled.

var allUsers = User.query();

// allUsers is an empty array that is filled as the promise for the resource is
// fulfilled
````

The $resource class does this to make it easy when injecting resource instances
into the scope; if the queries returned a promise directly, one would need to
do the following:

````js

// if queries returned promises we would need to do this
var user = User.get({id: 1});
user.then(function(){
    $scope.user = user;
});

// because if we attached the promise to the scope directly, it wouldn't know
// how to resolve it; interestingly, angular used to handle promises, but they
// deprecated the feature (probably for performance reasons)

// since $resource queireis return empty objects or arrays, we can do this
$scope.user = User.get({id: 1});

// because $scope.user will initially be an empty object, and when the
// underlying promise resolves, the data is attached, and the $digest cycle will
// know how to update the view

````

The underlying promise can be accessed via the `$promise` attribute (e.g.
`user.$promise`), and one can see if they have been resolved using the
`$resolved` attribute.

Unfortuneatly, although this "refernce injection" approach is useful in simple
cases when attaching resources onto the scope, it can be confusing when there
are related dependencies between resources.  In particular, if one tried
calling `$if` before a resource instance's underlying promise is resolved, it
would return 0!  To avoid this mistake, calling `$if` or `$rel` on an
unresolved resource instance will throw an error!

## Status of this module

This module is still in the development phase; it hasn't been used in any
production environments yet, and some of the core functionalty is still under
question.

That said, there is a set of unit tests for the core parts of the module, so it at least
basically works as advertised.

In particular:

- There may be a better way for the `$rel` method to determine if it should
  return an array vs an object.  For example, It may be desirable to have the
  `$rel` method return an array if the `_links` or `_embedded`.
- We may want to provide a different default type resolver.
- It may be nice to provide simpler support for chaining `$rel` calls (where
  you don't have to use promises directly).

Please email me at [johndgiese@gmail.com](mailto:johdgiese@gmail.com) if you
have any questions or suggestions!

## Thanks

The initial versions of this code were developed by [Cloudy Hills](cloudyhills.com),
a web-development company based out of Austin Texas.

Thanks for helpful discussions with;
- [Ian Littman](https://github.com/iansltx)
- [Ed Giese](https://github.com/edgiese)
- [Yujan Shrestha](https://github.com/yujanshrestha)

