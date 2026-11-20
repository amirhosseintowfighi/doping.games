import { currentUser } from './auth';
import { getSite } from './site';

/** What every page hands to the client store: site content and the signed-in user (no secrets). */
export async function initialState() {
  const [site, u] = await Promise.all([getSite(), currentUser()]);
  return {
    site,
    user: u ? { id: u.id, username: u.username, email: u.email, role: u.role, wallet: u.wallet } : null,
  };
}
