import {Dashboard} from './dashboard';
import {NewOrder} from './new-order';
import {Orders} from './orders';
import {Customers} from './customers';
import {Products} from './products';
import {Reports} from './reports';
import {SettingsPage} from './settings';
export function Workspace({view}:{view:string}){switch(view){case 'new-order':return <NewOrder/>;case 'orders':return <Orders/>;case 'customers':return <Customers/>;case 'products':return <Products/>;case 'reports':return <Reports/>;case 'settings':return <SettingsPage/>;default:return <Dashboard/>}}
