import ApiError from '../../utils/ApiError.js';
import Drawing from './drawing.model.js';

const LIST_LIMIT = 3000;
const MAX_PER_USER = 3000;

const serialize = (drawing) => ({
  id: String(drawing._id),
  color: drawing.color,
  width: drawing.width,
  points: drawing.points,
  createdAt: drawing.createdAt,
});

const inRange = (user, { from, to }) => ({
  owner: user._id,
  startAt: { $lt: to },
  endAt: { $gte: from },
});

export async function list(user, range) {
  const drawings = await Drawing.find(inRange(user, range))
    .sort({ createdAt: 1, _id: 1 })
    .limit(LIST_LIMIT);

  return drawings.map(serialize);
}

export async function create(user, { color, width, points }) {
  if ((await Drawing.countDocuments({ owner: user._id })) >= MAX_PER_USER) {
    throw new ApiError(409, 'На дошці забагато малюнків. Зітри частину й спробуй ще раз');
  }

  const times = points.map(([time]) => time);
  const drawing = await Drawing.create({
    owner: user._id,
    color,
    width,
    points,
    startAt: new Date(Math.min(...times)),
    endAt: new Date(Math.max(...times)),
  });

  return serialize(drawing);
}

export async function remove(user, id) {
  const { deletedCount } = await Drawing.deleteOne({ _id: id, owner: user._id });
  if (deletedCount === 0) throw new ApiError(404, 'Малюнок не знайдено');
}

export async function clear(user, range) {
  await Drawing.deleteMany(inRange(user, range));
}
