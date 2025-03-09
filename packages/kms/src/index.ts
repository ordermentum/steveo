import { Middleware, MiddlewareCallback, MiddlewareContext } from 'steveo';
import AWS from 'aws-sdk';

export class KMSMiddleware implements Middleware {
  client: AWS.KMS;

  keyId: string;

  constructor(keyId: string) {
    this.client = new AWS.KMS();
    this.keyId = keyId;
  }

  public async publish<Ctx = any, C = MiddlewareCallback>(
    context: MiddlewareContext<Ctx>,
    _next: C
  ) {
    context.payload = await this.encrypt(context.payload);
  }

  private async encrypt<T = any>(data: T): Promise<string> {
    const value = JSON.stringify(data);

    const params = {
      KeyId: this.keyId,
      Plaintext: Buffer.from(value),
    };

    const result = await this.client.encrypt(params).promise();

    if (!result.CiphertextBlob) {
      throw new Error('Failed to encrypt message');
    }

    return result.CiphertextBlob.toString('base64');
  }

  private async decrypt<T = any>(data: string): Promise<T> {
    const params = {
      KeyId: this.keyId,
      CiphertextBlob: Buffer.from(data),
    };

    const result = await this.client.decrypt(params).promise();

    if (!result.Plaintext) {
      throw new Error('Failed to decrypt message');
    }

    return JSON.parse(result.Plaintext.toString());
  }

  public async consume<Ctx = any, C = MiddlewareCallback>(
    context: MiddlewareContext<Ctx>,
    _next: C
  ) {
    context.payload = await this.decrypt(context.payload);
  }
}

export default KMSMiddleware;
