app.directive "ocAutosize", ($parse)->
  require: "?ngModel"
  restrict: "A"
  link: (scope, element, attrs, controller)->
    render = (value)->
      element.autosize()
    if controller?
      prev = controller.$render
      controller.$render = ->
        prev.apply controller, arguments...
        render controller.$viewValue
        controller.$viewValue