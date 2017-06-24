// @flow

import KafkaAdmin from '../admin/kafka';
import type { IAdmin, Configuration } from '../../types';

type AdminsType = {
  [key: string]: typeof KafkaAdmin,
};

const Admins: AdminsType = {
  kafka: KafkaAdmin,
};

const getAdmin = (
  type: string,
  config: Configuration,
): IAdmin => new Admins[type](config);

export default getAdmin;
