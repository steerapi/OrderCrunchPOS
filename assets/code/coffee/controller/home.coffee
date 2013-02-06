Kinvey = require "../lib/kinvey"
StarIO = require "../forge/stario"
async = require "async"

sprintf = require "sprintf"
sprintf = sprintf.vsprintf
itemCol = 21
qtyCol = 4
priceCol = 7
itemFormat = "%-#{itemCol}s %#{qtyCol}s %#{priceCol}s"

class HomeCtrl
  commit: (entity,cb)->
    # cb?()
    entity.set "printed", "yes"
    entity.save
      success: ->
        cb?()
      error: (e)->
        cb? e
  getItemInfo: (item, qty, price)->
    items = item.split(",")
    item = ""   
    # wrap text in item column
    for string,nline in items
      # if nline==0
      #   item += sprintf "%-#{itemCol}s", [string.substr(0, itemCol)]
      #   return
      words = string.split(":")
      for string2 in words
        len = string2.length
        nl = Math.ceil(len / itemCol)
        for i in [0...nl]
          if nline==0
            item += sprintf "%-#{itemCol}s", [string2.substr(i * itemCol, itemCol)]
          else
            item += sprintf "%-#{itemCol}s", [string2.substr(i * itemCol, itemCol)]
    info = ""
    # calculate total lines needed
    numlines = Math.ceil(Math.max(item.length / itemCol, qty.length / qtyCol, price.length / priceCol))
  
    for i in [0...numlines]
      itemLine = item.substr(i * itemCol, itemCol)
      qtyLine = qty.substr(i * qtyCol, qtyCol)
      priceLine = price.substr(i * priceCol, priceCol)
      info += sprintf itemFormat, [itemLine, qtyLine, priceLine]
      if i!=numlines-1
        info += "\n"
    return info    
  getItemsInfo: (items)->
    info = ""
    for item in items
      info += @getItemInfo "#{item.name}, #{item.desc}", "#{item.qty}", "#{(+item.price).toFixed(2)}"
    return info
  constructReceipt: (entity)->
    if entity.paid == "yes"
      fund = "#{entity.fundSourceType} #{entity.lastFourDigits}"
    else
      fund = "Not Paid" 
    itemHead = sprintf itemFormat, ["Items","Qty","Price"]
    itemInfo = @getItemsInfo entity.items
  
    subtotalLine = sprintf itemFormat, ["Subtotal","","#{(+entity.subtotal).toFixed(2)}"]
    taxLine = sprintf itemFormat, ["Tax","","#{(+entity.tax).toFixed(2)}"]
    totalLine = sprintf itemFormat, ["Total","","#{(+entity.total).toFixed(2)}"]
  
    text = """
#{entity.to.name}
#{entity.to.streetAddress}, #{entity.to.city}, #{entity.to.state}, #{entity.to.zipcode}

ID: #{entity._id}
Ordered: #{entity.orderedAt}
----------------------------------
#{itemHead}
----------------------------------
#{itemInfo}
----------------------------------
#{subtotalLine}
#{taxLine}
----------------------------------
#{totalLine}
----------------------------------
Order Information
Paid: #{fund}
Pick up: #{entity.pickupAt}
Customer name: #{entity.from.name}

Powered by OrderCrunch
    """
    # console.log text
    return text
  print: (entity,cb)->
    text = @constructReceipt(entity.toJSON(true))
    @show text
    StarIO.printReceipt text, (err)=>
      if not err?
        #commit
        @commit entity,=>
          cb?()
      else
        cb?()
  show: (text)->
    @scope.list.splice 0,0,text
    @scope.$apply() if not @scope.$$phase
  find: (cb)->
    q = new Kinvey.Query()
    q.on("paid").equal "yes"
    q.on("printed").notEqual "yes"
    q.on("pickupUnix").sort Kinvey.Query.ASC
    orders = new Kinvey.Collection("orders", query:q)
    orders.fetch
      success: (list)=>
        @scope.list = []
        # @scope.list = list.map (entity)=>
        #   entity.toJSON(true)
        # console.log @scope.list
        # @scope.$apply()
        async.forEachSeries list, (entity,cb)=>
          @print(entity,cb)
        ,->
          cb?()
      error: (e)->
        cb? e
  constructor: (@scope)->
    # console.log "CREATED"
    $.extend @scope, @
    StarIO.startHeartbeat(15000)
    # do x = =>
    #   setTimeout =>
    #     # console.log "find"
    #     q.push {}
    #     x()
    #   , 5000
    
    q = async.queue (task, cb)=>
      @find(cb)
    , 1
    StarIO.on "stario.heartbeat", =>
      StarIO.checkStatus (err,status)=>
        @scope.status = status.status if not err?
        @scope.$apply() if not @scope.$$phase
      q.push {}

HomeCtrl.$inject = ["$scope"]
app.controller("HomeCtrl", HomeCtrl)
