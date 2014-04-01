describe('The hal resource', function() {

  beforeEach(module("hyperResource"));

  var hResource, $httpBackend;
  beforeEach(inject(function($injector) {
    hResource = $injector.get('hResource');
    $httpBackend = $injector.get('$httpBackend');
  }));
  

  afterEach(function() {
    $httpBackend.verifyNoOutstandingExpectation();
    $httpBackend.verifyNoOutstandingRequest();
  });

  
  it("is very similar to the ngResource app's $resource service", function() {
    var className = 'pet';
    var Pet = hResource(className, '/pets/:id', {id: '@id'});
    var fluffy = new Pet();
    fluffy.species = 'cat';

    var someId = 1234;

    fluffy.$save(function(data){
      fluffy.id = data.id;
    });
    $httpBackend.expectPOST('/pets').respond(200, {id: someId});
    $httpBackend.flush();

    expect(fluffy.id).toBe(someId);

    fluffy.$delete();
    $httpBackend.expectDELETE('/pets/' + someId).respond(200);
    $httpBackend.flush();  
  });


  describe('provides some abstractions for Hypertext Application Language:', function() {

    var Book;
    beforeEach(function() {
      Book = hResource('book', '/books/:id', {id: '@id'});
    });
    
    it("resource instances have an extra `$rel` method", function() {
      var book = new Book();
      expect(book.$rel).toBeDefined();
    });

    it('the `$rel` method will follow HAL links', function() {
      var title = 'Anna Karenina';

      var annaKareninaData = {
        id: 1,
        title: title,
        _links: {
          next: {
            href: '/books/2',
            type: 'book'  // used to resolve instance type
          }
        }
      };

      $httpBackend.expectGET('/books?title=Anna+Karenina').respond(200, annaKareninaData);

      var book = Book.get({title: title});
      $httpBackend.flush();

      expect(book.id).toBe(1);

      var theGoodPartsData = {
        id: 2,
        title: 'Javascript: The Good Parts',
        author: 'Douglas Crockford'
      };

      $httpBackend.expectGET('/books/2').respond(200, theGoodPartsData);
      book.$rel('next');
      $httpBackend.flush();
    });


    it('the `$rel` method will also grab embedded resources', function() {

      var Person = hResource('person', '/person/:id', {id: '@id'});

      Person.prototype.name = function() {
        return this.firstName + ' ' + this.lastName;
      };

      var bookData = {
        title: 'Code Complete',
        edition: 2,
        _embedded: {
          author: {
            _links: {
              self: {
                href: '/authors/1',
                type: 'person',
              }
            },
            id: 1,
            firstName: 'Steve',
            lastName: 'McConnel'
          }
        }
      };

      var book = new Book(bookData);

      var author = book.$rel('author');

      author.then(function(author){
        expect(author instanceof Person).toBe(true);
        expect(author.name()).toBe('Steve McConnel');
      });
    });

    var bookData = {
      title: 'The Design of Everyday Things',
      _embedded: {
        related: [
          {
            title: "Don't make me think",
          },
          {
            _links: {self: {name: "reference"}},
            title: "The Elements of Typographic Style",
          }
        ]
      }
    };
    
    it('the `$rel` method will return an array of related resources if there are more than one links', function() {

      var book = new Book(bookData);

      book.$rel('related').then(function(result) {
        expect(result.length).toBe(2);
        expect(result[0] instanceof Book).toBe(false);  // because there is no self link!
        expect(result[1].title).toBe("The Elements of Typographic Style");
      })

    });

    it("resource instances alse have an extra `$if` method", function() {
      var book = new Book();
      expect(book.$if).toBeDefined();
    });

    it("the `$if` method returns the number of related resource", function() {
      var book = new Book(bookData);
      expect(book.$if).toBeDefined();
      expect(book.$if('related')).toBe(2);
      expect(book.$if('related', 'reference')).toBe(1);
      expect(book.$if('related', 'journals')).toBe(0);
    });

  });

  var bookData = {
    title: 'Transport Phenomena',
    _links: {
      self: {
        href: '/books/0',
      },
      next: {
        href: '/books/1',
        title: 'Introduction to Fourier Optics',
      }
    },
    _embedded: {
      chapter: [
        {
          title: 'Viscosity and the Mechanism of Momentum Transport',
          _links: {
            self: {
              href: '/books/0/chapter/1',
              type: 'chapter',
            }
          },
          _embedded: {
            section: [
              {title: "Newton's Law of Viscosity"},
              {title: "Generalized Newton's Law"},
              {title: "Pressure and Temperture Dependence"}
            ]
          }
        },
        {
          title: 'Shell Momentum Balances',
          _links: {
            self: {
              href: '/books/0/chapter/2',
              type: 'chapter',
            }
          },
        }
      ]
    }
  };

  describe("doesnt' require a declared resource type", function() {

    var Book;
    beforeEach(function() {
      Book = hResource('/books/:id', {id: '@id'});
    });

    it('even so we still get the extra methods (`$rel`, `$if`, etc.).', function() {
      
      var book = new Book(bookData);

      expect(book instanceof Book).toBe(true);

      book.$rel('chapter').then(function(chapters){

        // because we don't register they type name, there is no way for the
        // hyper resource to know what type it should be
        expect(chapters[0] instanceof Book).toBe(false);

        // but it will still have the `$rel` and `$if` methods because they are
        // inhereted from the `HyperObject`
        expect(chapters[0].$if('section')).toBe(3);
        expect(chapters[1].$if('section')).toBe(0);
        chapters[0].$rel('section').then(function(sections) {
          expect(sections[0].title).toBe("Newton's Law of Viscosity");
        });

      });
    });
  });


  it("the `$rel` method can't be called from an unresolved resource.", function() {

    Book = hResource('/books/:id', {id: '@id'});
    $httpBackend.expectGET('/books/1').respond(200, bookData);

    var book = Book.get({id: 1});

    function getChapters(){
      book.$rel('chapter');
    }

    expect(getChapters).toThrow();

    book.$promise.then(function(){
      expect(getChapters).not.toThrow()
    });

    $httpBackend.flush();
    
  });


  it("the `$if` method returns `0` from unresolved resource.", function() {

    var Book = hResource('/books/:id', {id: '@id'});
    $httpBackend.expectGET('/books/1').respond(200, bookData);

    var book = Book.get({id: 1});

    function getChapterCount(){
      book.$if('chapter');
    }

    expect(getChapterCount).not.toThrow();

    book.$promise.then(function(){
      expect(getChapterCount).not.toThrow()
      expect(book.$if('chapter')).toBe(2);
    });

    $httpBackend.flush();
    
  });


  it('provide a `$link` and `$links` methods', function() {

    var Book = hResource('/books/:id', {id: '@id'});
    var book = new Book(bookData);

    expect(book.$link('nonexistent')).toBe(undefined);
    expect(book.$link('self').href).toBe('/books/0');
    expect(book.$link('next').href).toBe('/books/1');
    expect(book.$link('next').title).toBe('Introduction to Fourier Optics');

    function getChapterLink() {
      return book.$link('chapter');
    }

    function getChapterLinks() {
      return book.$links('chapter');
    }

    expect(getChapterLink).toThrow();
    expect(getChapterLinks).not.toThrow();
    expect(angular.isArray(book.$links('chapter'))).toBe(true);

    var expectedChapterLinks = [
        {
          href: '/books/0/chapter/1',
          type: 'chapter',
        },
        {
          href: '/books/0/chapter/2',
          type: 'chapter',
        }
    ];

    expect(getChapterLinks()).toEqual(expectedChapterLinks);
    
  });
  
});
