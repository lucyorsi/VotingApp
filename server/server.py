#!/usr/bin/env python

import tornado.httpserver
import tornado.ioloop
import tornado.web
import tornado.websocket

class WebSocketHandler(tornado.websocket.WebSocketHandler):
   def open(self): 
      print("websocket opened") 

   def on_message(self, message):
      print(message)
      self.write_message(u"Your message was: " + message)

   def on_close(self): 
      print("websocket closed")

class IndexPageHandler(tornado.web.RequestHandler):
   def get(self):
      self.render("index.html")

class Application(tornado.web.Application):
   def __init__(self):
      handlers = [
          (r'/', IndexPageHandler),
          (r'/websocket', WebSocketHandler)
      ]

      tornado.web.Application.__init__(self, handlers)

if __name__ == '__main__':
   ws_app = Application()
   server = tornado.httpserver.HTTPServer(ws_app)
   server.listen(8080)
   tornado.ioloop.IOLoop.instance().start() 
