import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosRequestConfig, Method } from 'axios';

@Injectable()
export class ProxyService {
  constructor(private readonly httpService: HttpService) {}

  async forward(
    targetBaseUrl: string,
    path: string,
    method: Method,
    data?: any,
    headers?: any,
  ) {
    const url = `${targetBaseUrl}${path}`;

    const forwardHeaders = { ...headers };
    delete forwardHeaders.host;
    delete forwardHeaders['content-length'];

    const config: AxiosRequestConfig = {
      method,
      url,
      data,
      headers: forwardHeaders,
    };

    try {
      const response = await firstValueFrom(this.httpService.request(config));
      return response.data;
    } catch (error: any) {
      if (error.response) {
        throw new HttpException(error.response.data, error.response.status);
      }
      throw new HttpException(
        'Microservicio no disponible',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}