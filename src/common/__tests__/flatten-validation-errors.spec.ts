import { flattenValidationErrors } from '../flatten-validation-errors';
import { ValidationError } from 'class-validator';

describe('flattenValidationErrors', () => {
  it('flattens nested constraint messages', () => {
    const errors = [
      {
        property: 'http',
        children: [
          {
            property: 'url',
            constraints: { isUrl: 'HTTP URL must use http or https' },
            children: [],
          },
        ],
      },
    ] as unknown as ValidationError[];

    expect(flattenValidationErrors(errors)).toEqual([
      'HTTP URL must use http or https',
    ]);
  });
});
