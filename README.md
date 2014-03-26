# Hyper Resource

Hyper Resource is an [angularjs](http://angularjs.org) module that extends angular's
native `$resource` service to work well with Hypermedia APIs using [HAL](http://stateless.co/hal_specification.html).

## HATEOAS and Linking within an API

Single page applications usually require an API to persist data.

One of the tenants of RESTful APIs is the principal of [HATEOAS](http://en.wikipedia.org/wiki/HATEOAS), or 
Hypermedia as the Engine of Application State.  The word sounds complicated,
and maybe it is complicated and I don't understand it fully, but I see HATEOAS
to mean your API should be a state-machine, and state-transitions should occur
by following some sort of "hyperlink".  If you think about it, this is how the
web works: we go to a page (a resource, or state) and we move to other pages by
clicking links (state transitions).

Very few APIs fully follow HATEOAS, and there is quite a bit of debate online
as to how important it is.  I think one of the reasons many APIs don't follow
it, is simply because unlike humans browsing the web, how will follow links as
their curiosity directs, machines are usually interacting with a resource for a
set purpose.  Thus the idea that a machine will `discover` and API purely
through links doesn't seem to work.  That said, I think there are some serious
benefits for using HATEOAS when it makes sense (statement intentionally open-ended).

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
the current chapter.  HAL has a second reserverd keyword, `_embedded`, that is
reserved for this purpose.  It works nearly identically to links.


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

So that is HAL!  Quite simple really.  I should also mention that you can use the special mime type, "application/hal+json", if you want to.

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
it would also be nice if the service provided convenience methods for interacting with 
related resources.  This is where the `hyperResource` module comes in.  It provides a single service, `hResource`, 
that is a small and somewhat opinionated extension of the `$resource` service.

## Linked and embedded resources are assumed to be semantically identical

The hResource service attempts to abstract away the distinction between a `_linked` and `_embedded` resource;
from the angular app's perspective, the distinction should be purely a matter of performance.  When resolving a related
resource, the hResource returns a promise for that resource.  If it is embedded, the promise will be fulfilled quickly, if 
is a link, it will be a fulfilled after another round trip to the API.  This abstraction allows the API to worry about 
performance and caching issues, while freeing the client to work with the resources.

From now on, a "related resource" can be either linked or embedded, as the distinction is irrelevant.

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

hResource instances are provided all of the `$resource` methods (e.g. `$save`), in addition to two convenience 
methods specifically for interacting with related resources.




### The `$rel` resource instance method


### The `$if` resource instance method



except resource instances are provided an extra `$get` method that
takes two properties, `relation` and optionally `name`, and returns a
promise to these related resources.  If there is more than one related
resource, the promise resolves to an array of resources.  If there is
just one resource, the promise resolves to that individual resource.


## Advanced Use with the Active Record Design Pattern

except they take an extra first argument when being instantiated.  The
remaining three arguments are identical to those passed into the $resource
service.

### Default resource type resolver uses the `type` link attribute

### Custom resource type resolver

The hResourceProvider has a single function,
`setResourceTypeResolver`.  Once can pass in a custom typeResolver,
i.e. a function that takes a link or embedded resource and
returns a string matching the appropriate hResource's `resourceName`.  All
typeResolver functions should return `undefined` if they can not resolve a
type.  If the resolved type is undefined, or does not match any declared
`resourceType`s, then the Object type is used instead.

## Additional Constraints placed on the HAL specification

In summary, the default setup of the hyperResource module places these
additional restrictions on a HAL API:

  - embedded and linked resources are semantically identical, and
    collectively are referred to as "related resources"
  - a related resource should either appear as an embedded or a link,
    otherwise two copies of the resource will be returned by the instance
    `$get` method
  - if the client wants to use the Active Record pattern by extending
    resource prototypes, then the API must provide a way to resolve the
    resource types; using the default resourceTypeResolver, this means that
    all links must provide a `type` attribute, and all embedded resources
    must have a self link with a `type` attribute.
  - the plurality of a specified "related resource" should be consistent
    accross calls to keep the client code simple


## Thanks

The initial versions of this code were developed by [Cloudy Hills](cloudyhills.com),
a web-development company based out of Austin Texas.
