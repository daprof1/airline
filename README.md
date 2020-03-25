An opensource airline game. 

Live at https://www.airline-club.com/

![Screenshot 1](https://user-images.githubusercontent.com/2895902/74759887-5a966380-522e-11ea-9e54-2252af63d5ea.gif)
![Screenshot 2](https://user-images.githubusercontent.com/2895902/74759902-6124db00-522e-11ea-9f81-8b4af7f7027e.gif)
![Screenshot 3](https://user-images.githubusercontent.com/2895902/74759935-739f1480-522e-11ea-9323-e84095177d5a.gif)



## Setup
1. install git :D of course
2. clone this repo ;D
3. Install at least java development kit 8+
4. The 2 main projects are : airline-web (all the front-end stuff) and airline-data (the backend simulation).(Optional) If you want to import them to Scala IDE (if you want to code), goto the folder of those and run `activator eclipse` to generate the eclipse project files and then import those projects into your IDE
5. This runs on mysql db (install veresion 5.x, i heard newest version 8.x? might not work). install Mysql server and then create database `airline`, create a user `sa`, for password you might use `admin` or change it to something else. Make sure you change the corresponding password logic in the code to match that (https://github.com/patsonluk/airline/blob/master/airline-data/src/main/scala/com/patson/data/Constants.scala#L99)
6. `airline-web` has dependency on `airline-data`, hence navigate to `airline-data` and run `activator publishLocal`. If you see [encoding error](https://github.com/patsonluk/airline/issues/267), add character_set_server=utf8mb4 to your /etc/my.cnf and restart mysql. it's a unicode characters issue, see https://stackoverflow.com/questions/10957238/incorrect-string-value-when-trying-to-insert-utf-8-into-mysql-via-jdbc
7. You would need to initialize the DB and data on first run. In `airline-data`, run `activator run`, then choose the one that runs `MainInit`. It will take awhile to init everything. If it runs to the part that is getting images from wiki, you might terminate it (cause it will take hours to get all images) - just that not airport will have images (not a big deal **shrug**)
8. Now run the background simulation by staying in `airline-data`, run `activator run`, select option `MainSimulation`. It should now run the backgroun simulation
9. Open another terminal, navigate to `airline-web`, run the web server by `activator run`
10. The application should be accessible at `localhost:9000`


