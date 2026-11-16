import User from '../modules/users/user.model.js';
import ApiError from '../utils/ApiError.js';
import { verifyAccessToken } from '../utils/tokens.js';

const UNAUTHORIZED = 'Сесія недійсна або закінчилась, увійди знову';

export default async function auth(req, res, next) {
  try {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new ApiError(401, 'Потрібна авторизація');

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new ApiError(401, UNAUTHORIZED);
    }

    const user = await User.findById(payload.sub);
    if (!user || user.tokenVersion !== payload.tv) throw new ApiError(401, UNAUTHORIZED);

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
