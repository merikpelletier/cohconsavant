import Admin from './pages/Admin';
import Boutique from './pages/Boutique';
import Cart from './pages/Cart';
import CartExport from './pages/CartExport';
import Checkout from './pages/Checkout';
import Content from './pages/Content';
import ContentDebug from './pages/ContentDebug';
import DataDebug from './pages/DataDebug';
import Index from './pages/Index';
import Magazine from './pages/Magazine';
import Plus from './pages/Plus';
import ProductDebug from './pages/ProductDebug';
import ProductDetail from './pages/ProductDetail';
import Quiz from './pages/Quiz';
import Salons from './pages/Salons';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Admin": Admin,
    "Boutique": Boutique,
    "Cart": Cart,
    "CartExport": CartExport,
    "Checkout": Checkout,
    "Content": Content,
    "ContentDebug": ContentDebug,
    "DataDebug": DataDebug,
    "Index": Index,
    "Magazine": Magazine,
    "Plus": Plus,
    "ProductDebug": ProductDebug,
    "ProductDetail": ProductDetail,
    "Quiz": Quiz,
    "Salons": Salons,
}

export const pagesConfig = {
    mainPage: "Index",
    Pages: PAGES,
    Layout: __Layout,
};