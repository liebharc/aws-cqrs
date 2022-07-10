/**
 * @format
 * This file belongs to app. It seems the file needs to be next to the node_modules directory. Until NPM adds a nohoist option we will need this a workaround.
 */

import { AppRegistry } from 'react-native';
import App from './app/App';
import { name as appName } from './app/app.json';

AppRegistry.registerComponent(appName, () => App);
