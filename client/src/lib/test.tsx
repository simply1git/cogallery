import * as React from 'react';

interface TestProps {
  children: React.ReactNode;
}

class TestComponent extends React.Component<TestProps, Record<string, never>> {
  render() {
    return <div>{this.props.children}</div>;
  }
}

export default TestComponent;