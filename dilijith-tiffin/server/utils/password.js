import bcrypt from 'bcryptjs';
export const hashPassword = password => bcrypt.hash(password, 10);
