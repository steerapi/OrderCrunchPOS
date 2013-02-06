$ ->
  forge?.internal.call "inspector.list", {}, ((methods) ->
    modules = {}
    for method of methods
      parts = method.split(".")
      apimethod = parts.pop()
      module = parts.join(".")
      modules[module] = {}  unless modules[module]
      modules[module][apimethod] = methods[method]
    for module of modules
      $("#_module").append "<option>" + module + "</option>"
    $("#_module").change ->
      methods = modules[$(this).val()]
      $("#_method").html ""
      for method of methods
        $("#_method").append "<option>" + method + "</option>"
      $("#_method").change()

    $("#_module").change()
    $("#_method").change ->
      module = $("#_module").val()
      method = $(this).val()
      params = modules[module][method]
      $(".api_input").detach()
      for param of params
        $("#_actions").before "<div class=\"control-group api_input\"><label class=\"control-label\" for=\"" + param + "\">" + param + "</label><div class=\"controls\"><input type=\"text\" class=\"input-xlarge\" id=\"" + param + "\"></div></div>"

    $("#_method").change()
    $("#_run").click ->
      module = $("#_module").val()
      method = $("#_method").val()
      params = {}
      $(".api_input input").each (i, x) ->
        convert = +$(x).val()
        if isNaN(convert)
          params[$(x).attr("id")] = $(x).val()
        else
          params[$(x).attr("id")] = convert

      $("#_output").prepend "<pre class=\"alert alert-info\">Called \"" + module + "." + method + "\" with \"" + JSON.stringify(params, null, "") + "\"</pre>"
      forge?.internal.call module + "." + method, params, (->
        $("#_output").prepend "<pre class=\"alert alert-success\">Success for \"" + module + "." + method + "\" with \"" + JSON.stringify(arguments[0], null, "") + "\"</pre>"
      ), ->
        $("#_output").prepend "<pre class=\"alert alert-error\">Error for \"" + module + "." + method + "\" with \"" + JSON.stringify(arguments[0], null, "") + "\"</pre>"


  ), ->
    alert "Error"

  forge?.internal.addEventListener "*", (event, e) ->
    if event is "inspector.eventTriggered"
      $("#_output").prepend "<pre class=\"alert alert-warning\">Native event triggered \"" + e.name + "\"</pre>"
    else if event is "inspector.eventInvoked"
      if e["class"] is "ForgeEventListener"
        $("#_output").prepend "<pre class=\"alert alert-warning\">Default event listener for \"" + e.name + "\" called</pre>"
      else
        $("#_output").prepend "<pre class=\"alert alert-warning\">Calling event listener \"" + e.name + "\" in class \"" + e["class"] + "\"</pre>"
    else
      $("#_output").prepend "<pre class=\"alert alert-warning\">Javascript event \"" + event + "\" triggered with data \"" + JSON.stringify(e) + "\"</pre>"

