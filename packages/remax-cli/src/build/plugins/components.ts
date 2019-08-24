import * as path from 'path';
import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { get } from 'dot-prop';
import { kebabCase } from 'lodash';
import { Adapter } from '../adapters';

export interface Element {
  id: string;
  type: string;
  props: string[];
  path: string;
}

const elements: Element[] = [];
let elementId = 0;

const generateId = () => {
  elementId += 1;
  return elementId.toString();
};

export default (adapter: Adapter) => () => ({
  visitor: {
    JSXElement(nodePath: NodePath, state: any) {
      const node = nodePath.node as t.JSXElement;
      if (t.isJSXIdentifier(node.openingElement.name)) {
        const tagName = node.openingElement.name.name;
        const binding = nodePath.scope.getBinding(tagName);
        if (!binding) {
          return;
        }
        const componentPath = get(binding, 'path') as NodePath;
        if (
          !componentPath ||
          !t.isImportSpecifier(componentPath.node) ||
          !t.isImportDeclaration(componentPath.parent) ||
          !componentPath.parent.source.value.startsWith('remax/')
        ) {
          return;
        }

        const usedProps = node.openingElement.attributes.map(e => {
          if (t.isJSXAttribute(e)) {
            const propName = get(e, 'name.name') as string;
            return propName;
          }
        });

        const componentName = componentPath.node.imported.name;
        const type = kebabCase(componentName);
        const id = type + generateId();

        if (type === 'swiper-item') {
          return;
        }

        const props = usedProps
          .filter(prop => !!prop)
          .map(prop => adapter.getNativePropName(prop as string));

        const { filename, cwd } = state.file.opts;
        const modulePath = filename.replace(path.resolve(cwd, 'src') + '/', '');
        const elementPath = path.join(path.dirname(modulePath), id);

        node.openingElement.attributes.push(
          t.jsxAttribute(t.jsxIdentifier('__id__'), t.stringLiteral(id))
        );

        elements.push({
          id,
          type,
          props,
          path: elementPath,
        });
      }
    },
  },
});

export function getElements() {
  return elements;
}
