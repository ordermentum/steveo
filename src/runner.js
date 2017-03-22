// @flow
const Runner = (env: string, kafkaHost: string, registry: Object) => {
  const send = (topic: string, payload: Object) => {
    // send messages to kafka
    console.log(topic, payload);
  };

  const receive = async (payload: Object, topic: string) => {
    // receive messages from kafka
    const task = registry[topic];
    await task.subscribe(payload);
  };

  return {
    send,
    receive,
  };
};

export default Runner;
