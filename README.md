# GSoC 2016: Enabling Cesium for Liquid Galaxy
* GSoC  2016 Project Page: https://summerofcode.withgoogle.com/projects/#6055698639093760
* Mentor and Organization: Andrew Leahy, Liquid Galaxy Project
* Student: Abhishek V. Potnis

###  Abstract

Enabling other applications for Liquid Galaxy would greatly benefit the open source community, thereby nurturing the open source culture and encouraging inter-community bonding. This project aims at enabling Cesium - an open source virtual globe for Liquid Galaxy. The Liquid Galaxy project started off by making use of Google Earth for the panoramic system. The idea of this project is to enable Cesium to run across the multiple displays, providing an immersive and a riveting experience to the users. This project focuses on endowing Cesium with features such as Camera Synchronization, Content Synchronization across the displays and Space Navigation Camera Control.

### Deploying the Application

* Clone or download this repository.
* cd into the directory of this repository.
* Move this directory to host it on a server. On a Linux machine with an Apache server, it would be placed at /var/www/html/.
* Rename the sample-web-config.js to web-config.js and sample-node-config.js to node-config.js. Populate the web-config.js with the Bing Maps API Key.
 * To obtain your own Bing Maps API Key, please follow the steps given [here](https://msdn.microsoft.com/en-us/library/ff428642.aspx).
 * You may change the Server address in node-config.js and web-config.js. By default it is set to 'localhost'.
* `npm install`
* `node server.js` to start the Node relayer.
*  The application can now be accessed at:
  * Master Display: http://YOURSERVER/cesium-lg/Master-Client.html
  * Slave Displays: http://YOURSERVER/cesium-lg/Slave-Client.html?yaw=SOMEVALUE 
  on your web browser.
* Move the camera using the mouse on the Master display and the Slave will follow suit.
* Slave-Client.html expects a yaw parameter in the URL, if no yaw is provided, it mimics the Master. One needs to try it out different yaw values depending on the size and orientation of the displays to achieve perfect aligning.
* The application also supports Google Earth acting as the Master, while all Cesiums acting as Slaves. 
  * Please follow the steps given [here](https://github.com/LiquidGalaxy/liquid-galaxy/wiki/QuickStart) to set up the drivers.ini in your Google Earth installation, making sure that the ViewSync/port in drivers.ini  matches with the UDP_PORT in node-config.js.


