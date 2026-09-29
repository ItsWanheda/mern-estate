import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { hydrateUserFailure, hydrateUserStart, hydrateUserSuccess } from './redux/user/userSlice';
import { apiFetch } from './utils/api';
import Home from './pages/Home';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import About from './pages/About';
import Profile from './pages/Profile';
import Header from './components/Header';
import PrivateRoute from './components/PrivateRoute';
import CreateListing from './pages/CreateListing';
import UpdateListing from './pages/UpdateListing';
import Listing from './pages/Listing';
import Search from './pages/Search';

export default function App() {
  const dispatch = useDispatch();
  const { authHydrated } = useSelector((state) => state.user);

  useEffect(() => {
    let active = true;
    dispatch(hydrateUserStart());
    apiFetch('/api/auth/session')
      .then(async (res) => {
        const data = await res.json();
        if (!active) return;
        if (res.ok && data?._id) dispatch(hydrateUserSuccess(data));
        else dispatch(hydrateUserFailure());
      })
      .catch(() => {
        if (active) dispatch(hydrateUserFailure());
      });
    return () => { active = false; };
  }, [dispatch]);

  if (!authHydrated) return <div className='p-8 text-center'>Loading...</div>;

  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/sign-in' element={<SignIn />} />
        <Route path='/sign-up' element={<SignUp />} />
        <Route path='/about' element={<About />} />
        <Route path='/search' element={<Search />} />
        <Route path='/listing/:listingId' element={<Listing />} />

        <Route element={<PrivateRoute />}>
          <Route path='/profile' element={<Profile />} />
          <Route path='/create-listing' element={<CreateListing />} />
          <Route
            path='/update-listing/:listingId'
            element={<UpdateListing />}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
