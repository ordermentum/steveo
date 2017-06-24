import moment from 'moment';
import Kafka from 'no-kafka';

class KafkaProducer {
  constructor(config, registry, logger) {
    this.config = config;
    this.producer = new Kafka.Producer({
      connectionString: this.config.kafkaConnection,
      codec: this.config.kafkaCodec,
    });
    this.logger = logger;
    this.registry = registry;
  }

  initialize() {
    this.producer.init();
  }
  producerPayload(msg: Object, topic: string) {
    const timestamp = moment().unix();
    const payload = JSON.stringify(Object.assign({}, msg, { timestamp }));
    const size = Buffer.from(payload, 'utf-8');
    this.logger.info('Payload Size:', topic, size.length);
    return {
      timestamp,
      topic,
      message: {
        value: payload,
      },
    };
  }

  send = async (topic: string, payload: Object) => {
    const data = this.producerPayload(payload, topic);
    const sendParams = {
      retries: {
        attempts: this.config.kafkaSendAttempts,
        delay: {
          min: this.config.kafkaSendDelayMin,
          max: this.config.kafkaSendDelayMax,
        },
      },
    };

    try {
      await this.producer.send(data, sendParams);
      this.registry.events.emit('producer_success', topic, payload);
    } catch (ex) {
      this.logger.error('Error while sending payload:', JSON.stringify(payload, null, 2), 'topic :', topic, 'Error :', ex);
      this.registry.events.emit('producer_failure', topic, ex);
      throw ex;
    }
  }
}

export default KafkaProducer;
